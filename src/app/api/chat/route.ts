import { streamText } from 'ai';
import { getChatModel } from '@/lib/ai/provider';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { createCalendarTools } from '@/lib/ai/tools';
import { getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
import { getServerEnv } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Định dạng messages không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Kiểm tra cấu hình API Key
    try {
      getServerEnv();
    } catch (envError) {
      const msg = envError instanceof Error ? envError.message : 'Lỗi cấu hình biến môi trường';
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = await getServerSession().catch(() => null);
    let validAccessToken: string | null = null;
    if (session) {
      try {
        const { accessToken } = await getValidAccessToken(session);
        validAccessToken = accessToken;
      } catch {
        // Token hết hạn hoặc không làm mới được trong request scope
      }
    }

    const systemPrompt = buildSystemPrompt(session?.user?.email);
    const tools = createCalendarTools(session, validAccessToken);
    const model = getChatModel();

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 3, // Bounded multi-step execution
      onError: ({ error }) => {
        console.error('Chat stream error:', error);
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage: (err) => (err instanceof Error ? err.message : 'Lỗi xử lý AI'),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi máy chủ khi xử lý hội thoại AI';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
