import { APICallError, RetryError, streamText } from 'ai';
import { z } from 'zod';
import { getAdminModelConfig } from '@/lib/ai/admin-config';
import { getChatModel } from '@/lib/ai/provider';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { createCalendarTools } from '@/lib/ai/tools';
import { requireJsonContentType, requireSameOrigin } from '@/lib/auth/request-guards';
import { authErrorResponse, getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
import { isBearerSessionRequest } from '@/lib/calendar/calendar-auth';
import { checkChatRateLimit } from '@/lib/chat/rate-limit';
import { getServerEnv } from '@/lib/env';

const ToolCallSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.unknown()),
  step: z.number().int().nonnegative().optional(),
});
const ToolInvocationSchema = z.discriminatedUnion('state', [
  ToolCallSchema.extend({ state: z.literal('partial-call') }),
  ToolCallSchema.extend({ state: z.literal('call') }),
  ToolCallSchema.extend({ state: z.literal('result'), result: z.unknown() }),
]);
const MessagePartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('tool-invocation'), toolInvocation: ToolInvocationSchema }),
  z.object({ type: z.literal('step-start') }),
  z.object({
    type: z.literal('reasoning'),
    reasoning: z.string(),
    details: z.array(z.discriminatedUnion('type', [
      z.object({ type: z.literal('text'), text: z.string(), signature: z.string().optional() }),
      z.object({ type: z.literal('redacted'), data: z.string() }),
    ])),
  }),
  z.object({
    type: z.literal('source'),
    source: z.object({ sourceType: z.literal('url'), id: z.string(), url: z.string(), title: z.string().optional() }),
  }),
]);

const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(30000),
    // Attachments and file parts are unsupported; never let the SDK download client URLs.
    experimental_attachments: z.never().optional(),
    toolInvocations: z.array(ToolInvocationSchema).optional(),
    parts: z.array(MessagePartSchema).optional(),
  })).min(1).max(200),
});

const MODEL_STREAM_START_TIMEOUT_MS = 25_000;
const AI_UNAVAILABLE_MESSAGE = 'Dịch vụ AI hiện tạm thời quá tải hoặc không phản hồi. Vui lòng thử lại sau.';

class ModelStreamAttemptError extends Error {
  constructor(
    public readonly causeError: unknown,
    public readonly timedOut = false
  ) {
    super('Model stream attempt failed');
    this.name = 'ModelStreamAttemptError';
  }
}

function getErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if (APICallError.isInstance(error)) return error.statusCode;
  if (RetryError.isInstance(error)) {
    return getErrorStatusCode(error.lastError);
  }
  const record = error as Record<string, unknown>;
  if (typeof record.statusCode === 'number') return record.statusCode;
  if (typeof record.status === 'number') return record.status;
  if (record.lastError) return getErrorStatusCode(record.lastError);
  if (record.cause) return getErrorStatusCode(record.cause);
  return undefined;
}

function isTimeoutLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if (RetryError.isInstance(error)) return isTimeoutLikeError(error.lastError);
  const record = error as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name : '';
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string' ? record.message : '';
  if (
    name === 'TimeoutError' ||
    code === 'ETIMEDOUT' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    /timeout|timed out/i.test(message)
  ) {
    return true;
  }
  return record.cause ? isTimeoutLikeError(record.cause) : false;
}

function isFallbackEligibleError(error: unknown, timedOut: boolean, requestAborted: boolean): boolean {
  if (requestAborted) return false;
  if (timedOut) return true;
  const statusCode = getErrorStatusCode(error);
  if (statusCode === 429 || (statusCode !== undefined && statusCode >= 500 && statusCode <= 599)) {
    return true;
  }
  return isTimeoutLikeError(error);
}

async function readChunkWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number
): Promise<{ result: ReadableStreamReadResult<Uint8Array>; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read().then((result) => ({ result, timedOut: false })),
      new Promise<{ result: ReadableStreamReadResult<Uint8Array>; timedOut: boolean }>((resolve) => {
        timer = setTimeout(() => {
          resolve({ result: { done: true, value: undefined }, timedOut: true });
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function runModelStream(
  modelId: string,
  system: string,
  messages: ChatMessageInput[],
  tools: ReturnType<typeof createCalendarTools>,
  abortSignal: AbortSignal
): Promise<Response> {
  const model = getChatModel(modelId);
  let capturedError: unknown = null;

  const result = streamText({
    model,
    system,
    messages,
    tools,
    maxSteps: 3, // Bounded multi-step execution
    maxTokens: 4000,
    maxRetries: 0,
    abortSignal,
  });

  const dataResponse = result.toDataStreamResponse({
    getErrorMessage: (err) => {
      capturedError = err;
      return 'Không thể nhận phản hồi AI. Vui lòng thử lại.';
    },
  });

  if (!dataResponse.body) {
    return dataResponse;
  }

  const reader = dataResponse.body.getReader();
  const decoder = new TextDecoder();
  const bufferedChunks: Uint8Array[] = [];
  let linePrefix = '';

  try {
    while (true) {
      const { result: readResult, timedOut } = await readChunkWithTimeout(
        reader,
        MODEL_STREAM_START_TIMEOUT_MS
      );

      if (timedOut) {
        await reader.cancel().catch(() => undefined);
        throw new ModelStreamAttemptError(new Error('Model response timed out'), true);
      }

      if (capturedError !== null) {
        await reader.cancel().catch(() => undefined);
        throw new ModelStreamAttemptError(capturedError, false);
      }

      if (readResult.done) {
        break;
      }

      const chunk = readResult.value;
      const text = decoder.decode(chunk, { stream: true });
      const combined = linePrefix + text;
      const lines = combined.split('\n');
      linePrefix = lines.pop() ?? '';

      const hasErrorPart = lines.some((line) => line.startsWith('3:'));
      if (hasErrorPart || capturedError !== null) {
        await reader.cancel().catch(() => undefined);
        throw new ModelStreamAttemptError(capturedError ?? new Error('Stream error'), false);
      }

      bufferedChunks.push(chunk);

      // Buffer step-start header frames (`f:...`) so a pre-content stream error is still caught.
      const hasContentOrData = lines.some((line) => line.length > 0 && !line.startsWith('f:'));
      if (hasContentOrData || (linePrefix.length > 0 && !linePrefix.startsWith('f:'))) {
        break;
      }
    }
  } catch (error) {
    if (error instanceof ModelStreamAttemptError) {
      throw error;
    }
    await reader.cancel().catch(() => undefined);
    throw new ModelStreamAttemptError(error, false);
  }

  const combinedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of bufferedChunks) {
        controller.enqueue(chunk);
      }
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return new Response(combinedStream, {
    status: dataResponse.status,
    statusText: dataResponse.statusText,
    headers: dataResponse.headers,
  });
}

type ChatMessageInput = z.infer<typeof ChatRequestSchema>['messages'][number];

function hasRenderableAssistantPart(parts: NonNullable<ChatMessageInput['parts']>): boolean {
  return parts.some(
    (part) =>
      (part.type === 'text' && part.text.length > 0) ||
      (part.type === 'reasoning' && part.details.length > 0) ||
      part.type === 'tool-invocation'
  );
}

function sanitizeMessagesForStream(messages: ChatMessageInput[]): ChatMessageInput[] {
  const sanitized: ChatMessageInput[] = [];

  for (const message of messages) {
    if (message.role !== 'assistant') {
      sanitized.push(message);
      continue;
    }

    const hasIncompleteTool =
      message.toolInvocations?.some((tool) => tool.state !== 'result') ?? false;
    const hasIncompletePart =
      message.parts?.some(
        (part) => part.type === 'tool-invocation' && part.toolInvocation.state !== 'result'
      ) ?? false;

    if (!hasIncompleteTool && !hasIncompletePart) {
      sanitized.push(message);
      continue;
    }

    const completedTools = message.toolInvocations?.filter((tool) => tool.state === 'result');
    const filteredParts = message.parts?.filter(
      (part) => part.type !== 'tool-invocation' || part.toolInvocation.state === 'result'
    );
    const nextToolInvocations =
      completedTools && completedTools.length > 0 ? completedTools : undefined;
    const nextParts =
      filteredParts && hasRenderableAssistantPart(filteredParts) ? filteredParts : undefined;

    if (!message.content && !nextToolInvocations && !nextParts) {
      continue;
    }

    sanitized.push({
      role: message.role,
      content: message.content,
      ...(nextToolInvocations ? { toolInvocations: nextToolInvocations } : {}),
      ...(nextParts ? { parts: nextParts } : {}),
    });
  }

  if (sanitized.length === 0) {
    return [{ role: 'assistant', content: '' }];
  }

  return sanitized;
}

export async function POST(req: Request) {
  try {
    const contentTypeError = requireJsonContentType(req);
    if (contentTypeError) return contentTypeError;
    const originError = requireSameOrigin(req, 'Nguồn yêu cầu hội thoại không hợp lệ.', {
      'Cache-Control': 'no-store',
    });
    if (originError) return originError;

    const body = await req.text();
    if (new TextEncoder().encode(body).length > 512000) {
      return Response.json({ error: 'Hội thoại quá dài. Vui lòng bắt đầu hội thoại mới.' }, { status: 413 });
    }
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return Response.json({ error: 'Yêu cầu JSON không hợp lệ.' }, { status: 400 });
    }
    const parsed = ChatRequestSchema.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Định dạng messages không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages: rawMessages } = parsed.data;
    const messages = sanitizeMessagesForStream(rawMessages);

    // Kiểm tra cấu hình API Key
    try {
      getServerEnv();
    } catch {
      const msg = 'Máy chủ chưa được cấu hình AI đầy đủ.';
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = await getServerSession(req);
    let activeSession = session;
    let validAccessToken: string | null = null;
    if (session) {
      try {
        const { accessToken, updatedSession } = await getValidAccessToken(session, req);
        validAccessToken = accessToken;
        if (updatedSession) {
          activeSession = updatedSession;
        }
      } catch (error) {
        // Web chat remains available when Google Calendar needs reconnecting.
        if (isBearerSessionRequest(session, req)) {
          const authResponse = authErrorResponse(error);
          if (authResponse) return authResponse;
          return Response.json({ error: 'Vui lòng kết nối lại tài khoản Google.', code: 'AUTH_REQUIRED' }, { status: 401 });
        }
      }
    }

    const rateLimit = checkChatRateLimit(req, Boolean(activeSession));
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ một chút rồi thử lại.' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const systemPrompt = buildSystemPrompt(activeSession?.user?.email);
    const tools = createCalendarTools(activeSession, validAccessToken, { request: req });
    const { primaryModel, fallbackModel } = getAdminModelConfig();

    try {
      const response = await runModelStream(primaryModel, systemPrompt, messages, tools, req.signal);
      console.info('[chat] model served:', primaryModel);
      return response;
    } catch (primaryError) {
      const causeError =
        primaryError instanceof ModelStreamAttemptError ? primaryError.causeError : primaryError;
      const timedOut =
        primaryError instanceof ModelStreamAttemptError ? primaryError.timedOut : false;

      if (!isFallbackEligibleError(causeError, timedOut, req.signal.aborted)) {
        throw causeError;
      }

      if (!fallbackModel || fallbackModel === primaryModel) {
        return Response.json(
          { error: AI_UNAVAILABLE_MESSAGE },
          { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      console.warn('[chat] primary model failed, retrying with fallback:', primaryModel, '->', fallbackModel);

      try {
        const fallbackResponse = await runModelStream(
          fallbackModel,
          systemPrompt,
          messages,
          tools,
          req.signal
        );
        console.info('[chat] model served (fallback):', fallbackModel);
        return fallbackResponse;
      } catch {
        return Response.json(
          { error: AI_UNAVAILABLE_MESSAGE },
          { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const message = 'Lỗi máy chủ khi xử lý hội thoại AI. Vui lòng thử lại.';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
