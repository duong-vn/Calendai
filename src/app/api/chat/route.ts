import { streamText } from 'ai';
import { z } from 'zod';
import { getChatModel } from '@/lib/ai/provider';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { createCalendarTools } from '@/lib/ai/tools';
import { requireJsonContentType, requireSameOrigin } from '@/lib/auth/request-guards';
import { authErrorResponse, getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
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
  model: z.string().trim().max(200).optional(),
});

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

    const { messages: rawMessages, model: requestModel } = parsed.data;
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
    let validAccessToken: string | null = null;
    if (session) {
      try {
        const { accessToken } = await getValidAccessToken(session, req);
        validAccessToken = accessToken;
      } catch (error) {
        // Web chat remains available when Google Calendar needs reconnecting.
        if (req.headers.has('authorization')) {
          const authResponse = authErrorResponse(error);
          if (authResponse) return authResponse;
          return Response.json({ error: 'Vui lòng kết nối lại tài khoản Google.', code: 'AUTH_REQUIRED' }, { status: 401 });
        }
      }
    }

    const rateLimit = checkChatRateLimit(req, Boolean(session));
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

    const systemPrompt = buildSystemPrompt(session?.user?.email);
    const tools = createCalendarTools(session, validAccessToken);
    const selectedModelId =
      typeof requestModel === 'string' && requestModel.trim()
        ? requestModel.trim()
        : undefined;
    const env = getServerEnv();
    if (selectedModelId && selectedModelId !== env.AI_MODEL) {
      const catalogResponse = await fetch(`${env.AI_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${env.AI_API_KEY}` },
        next: { revalidate: 3600 },
        signal: req.signal,
      });
      if (!catalogResponse.ok) {
        return Response.json({ error: 'Không thể kiểm tra model. Vui lòng chọn model mặc định.' }, { status: 503 });
      }
      const catalog: unknown = await catalogResponse.json();
      const allowed = catalog && typeof catalog === 'object' && 'data' in catalog &&
        Array.isArray(catalog.data) && catalog.data.some((item: unknown) =>
          item !== null && typeof item === 'object' && 'id' in item && item.id === selectedModelId);
      if (!allowed) {
        return Response.json({ error: 'Model không nằm trong danh sách được máy chủ hỗ trợ.' }, { status: 400 });
      }
    }
    const model = getChatModel(selectedModelId);

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 3, // Bounded multi-step execution
      maxTokens: 4000,
      abortSignal: req.signal,
    });

    return result.toDataStreamResponse({
      getErrorMessage: () => 'Không thể nhận phản hồi AI. Vui lòng thử lại.',
    });
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
