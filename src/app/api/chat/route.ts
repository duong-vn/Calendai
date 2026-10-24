import { streamText } from 'ai';
import { z } from 'zod';
import { getChatModel } from '@/lib/ai/provider';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { createCalendarTools } from '@/lib/ai/tools';
import { authErrorResponse, getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
import { getServerEnv } from '@/lib/env';

const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(30000),
  }).passthrough()).min(1).max(200),
  model: z.string().trim().max(200).optional(),
});

export async function POST(req: Request) {
  try {
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

    const { messages, model: requestModel } = parsed.data;

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
