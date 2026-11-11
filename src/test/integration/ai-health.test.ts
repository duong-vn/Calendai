import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), model: vi.fn() }));
vi.mock('ai', () => ({ generateText: mocks.generate }));
vi.mock('@/lib/ai/provider', () => ({ getChatModel: mocks.model }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  mocks.model.mockReturnValue({});
  mocks.generate.mockResolvedValue({ text: 'OK' });
});
afterEach(() => vi.useRealTimers());

async function handler() {
  return (await import('@/app/api/health/ai/route')).GET;
}

describe('Public AI health endpoint', () => {
  it('reports a real nonempty response using the configured default model', async () => {
    const response = await (await handler())();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ status: 'ok', response: 'OK', latencyMs: 0 });
    expect(mocks.model).toHaveBeenCalledWith();
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0, maxTokens: 32, abortSignal: expect.any(AbortSignal) }));
  });

  it('shares concurrent probes and rechecks after 60 seconds', async () => {
    const GET = await handler();
    await Promise.all([GET(), GET(), GET()]);
    await GET();
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    await GET();
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it('reports empty responses as unavailable', async () => {
    mocks.generate.mockResolvedValue({ text: '   ' });
    const response = await (await handler())();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: 'error' });
  });

  it('caches failures without exposing provider error details', async () => {
    mocks.generate.mockRejectedValue(new Error('private provider diagnostic'));
    const GET = await handler();
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private provider diagnostic');
    expect((await GET()).status).toBe(503);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it('aborts the provider call after 15 seconds', async () => {
    mocks.generate.mockImplementation(({ abortSignal }: { abortSignal: AbortSignal }) => new Promise((_, reject) => {
      abortSignal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
    }));
    const GET = await handler();
    const pending = GET();
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await pending).status).toBe(503);
  });
});
