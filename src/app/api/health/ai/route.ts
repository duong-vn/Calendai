import { generateText } from 'ai';
import { getChatModel } from '@/lib/ai/provider';

export const dynamic = 'force-dynamic';

interface HealthResult {
  status: 'ok' | 'error';
  checkedAt: string;
  latencyMs: number;
  response?: string;
  error?: string;
}

// shortcut: cache and single-flight are per process; use a shared limiter if public probe traffic grows.
let cached: { result: HealthResult; expiresAt: number } | undefined;
let pending: Promise<HealthResult> | undefined;

async function probe(): Promise<HealthResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const { text } = await generateText({
      model: getChatModel(),
      prompt: 'Chỉ trả lời một từ: OK',
      maxTokens: 32,
      maxRetries: 0,
      abortSignal: controller.signal,
    });
    if (!text.trim()) throw new Error('Empty AI response');
    return {
      status: 'ok',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      response: text.trim().slice(0, 200),
    };
  } catch {
    return {
      status: 'error',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      error: 'AI không phản hồi hoặc nhà cung cấp hiện không khả dụng.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  let result: HealthResult;
  if (cached && cached.expiresAt > Date.now()) {
    result = cached.result;
  } else {
    pending ??= probe().then(value => {
      cached = { result: value, expiresAt: Date.now() + 60_000 };
      return value;
    }).finally(() => { pending = undefined; });
    result = await pending;
  }
  return Response.json(result, {
    status: result.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
