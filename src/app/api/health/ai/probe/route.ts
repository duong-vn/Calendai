import { generateText } from 'ai';
import { getAdminModelConfig } from '@/lib/ai/admin-config';
import { getChatModel } from '@/lib/ai/provider';

export const dynamic = 'force-dynamic';

interface HealthResult {
  status: 'ok' | 'error';
  checkedAt: string;
  latencyMs: number;
  response?: string;
  error?: string;
}

const DEFAULT_MODEL_CACHE_KEY = '__default__';

function getActiveProbeModelKey(): string {
  try {
    return getAdminModelConfig().primaryModel;
  } catch {
    return DEFAULT_MODEL_CACHE_KEY;
  }
}

// shortcut: cache and single-flight are per process; use a shared limiter if public probe traffic grows.
const cached = new Map<string, { result: HealthResult; expiresAt: number }>();
const pending = new Map<string, Promise<HealthResult>>();

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
  const modelKey = getActiveProbeModelKey();
  const now = Date.now();
  const cachedEntry = cached.get(modelKey);
  let result: HealthResult;
  if (cachedEntry && cachedEntry.expiresAt > now) {
    result = cachedEntry.result;
  } else {
    let inflight = pending.get(modelKey);
    if (!inflight) {
      inflight = probe()
        .then((value) => {
          const settledAt = Date.now();
          for (const [key, entry] of cached.entries()) {
            if (entry.expiresAt <= settledAt) {
              cached.delete(key);
            }
          }
          cached.set(modelKey, { result: value, expiresAt: settledAt + 60_000 });
          return value;
        })
        .finally(() => {
          if (pending.get(modelKey) === inflight) {
            pending.delete(modelKey);
          }
        });
      pending.set(modelKey, inflight);
    }
    result = await inflight;
  }
  return Response.json(result, {
    status: result.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
