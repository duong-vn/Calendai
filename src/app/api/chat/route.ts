import { streamText } from 'ai';
import { getChatModel } from '@/lib/ai/provider';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { createCalendarTools } from '@/lib/ai/tools';
import { getServerSession } from '@/lib/auth/server-session';
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
    const systemPrompt = buildSystemPrompt(session?.user?.email);
    const tools = createCalendarTools();
    const model = getChatModel();

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 3, // Bounded multi-step execution
    });

    return result.toDataStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi máy chủ khi xử lý hội thoại AI';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
