// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { APICallError, simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetChatRateLimit } from '@/lib/chat/rate-limit';
import { encryptSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import type { SessionData } from '@/lib/auth/types';

const TEST_SECRET = 'test_session_secret_key_minimum_32_characters_long_12345';

let activeCookieToken: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && activeCookieToken
        ? { value: activeCookieToken }
        : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

function makeSession(email: string, id = 'user-1'): SessionData {
  return {
    user: { id, email, name: 'Test User' },
    tokens: {
      accessToken: 'google-access-token',
      refreshToken: 'google-refresh-token',
      expiresAt: Date.now() + 3600_000,
      tokenType: 'Bearer',
      scope: 'https://www.googleapis.com/auth/calendar.events',
    },
    createdAt: Date.now(),
  };
}

function makeSuccessModel(text: string, onStream?: () => void) {
  return new MockLanguageModelV1({
    doStream: async () => {
      onStream?.();
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: text },
            { type: 'finish', finishReason: 'stop', usage: { promptTokens: 5, completionTokens: 4 } },
          ],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

function makeHttpErrorModel(statusCode: number, message: string, onStream?: () => void) {
  return new MockLanguageModelV1({
    doStream: async () => {
      onStream?.();
      throw new APICallError({
        message,
        url: 'https://api.example.test/v1/chat/completions',
        requestBodyValues: {},
        statusCode,
        responseHeaders: {},
        responseBody: message,
        isRetryable: statusCode >= 500 || statusCode === 429,
      });
    },
  });
}

function makeTimeoutErrorModel(onStream?: () => void) {
  return new MockLanguageModelV1({
    doStream: async () => {
      onStream?.();
      throw Object.assign(new Error('Upstream request timed out'), { name: 'TimeoutError' });
    },
  });
}

describe('Admin model config & fallback integration', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    resetChatRateLimit();
    activeCookieToken = undefined;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calendai-admin-test-'));
    configPath = path.join(tempDir, 'admin-config.json');

    vi.stubEnv('AI_API_KEY', 'test-ai-key');
    vi.stubEnv('AI_MODEL', 'provider/env-primary');
    vi.stubEnv('AI_FALLBACK_MODEL', 'provider/env-fallback');
    vi.stubEnv('AI_BASE_URL', 'https://ai.example.test/v1');
    vi.stubEnv('SESSION_SECRET', TEST_SECRET);
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com, SecondAdmin@Example.com');
    vi.stubEnv('ADMIN_CONFIG_PATH', configPath);
  });

  afterEach(async () => {
    activeCookieToken = undefined;
    vi.doUnmock('@/lib/ai/provider');
    vi.doUnmock('ai');
    try {
      const { resetAdminModelConfigCache } = await import('@/lib/ai/admin-config');
      resetAdminModelConfigCache();
    } catch {
      // ignore
    }
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('blocks guest and non-admin requests to /api/admin/config and /admin middleware with 403 and enforces POST guards', async () => {
    const { GET, POST } = await import('@/app/api/admin/config/route');
    const { middleware } = await import('@/middleware');

    // 1. Guest GET/POST -> 403
    const guestGet = await GET(new Request('https://calendai.tduong.online/api/admin/config'));
    expect(guestGet.status).toBe(403);
    expect(await guestGet.json()).toMatchObject({ isAdmin: false });

    const guestPost = await POST(
      new Request('https://calendai.tduong.online/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({ primaryModel: 'provider/a', fallbackModel: 'provider/b' }),
      })
    );
    expect(guestPost.status).toBe(403);

    // 2. Non-admin cookie -> middleware returns 403, API returns 403
    const userCookie = await encryptSession(makeSession('member@example.com', 'u-member'), TEST_SECRET);
    const mwGuest = await middleware(new NextRequest('https://calendai.tduong.online/admin'));
    expect(mwGuest.status).toBe(403);

    const mwMember = await middleware(
      new NextRequest('https://calendai.tduong.online/admin', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${userCookie}` },
      })
    );
    expect(mwMember.status).toBe(403);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ data: [{ id: 'provider/a' }, { id: 'provider/b' }] }))
    );

    activeCookieToken = userCookie;
    const memberGet = await GET(new Request('https://calendai.tduong.online/api/admin/config'));
    expect(memberGet.status).toBe(403);

    const memberPost = await POST(
      new Request('https://calendai.tduong.online/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({ primaryModel: 'provider/a', fallbackModel: 'provider/b' }),
      })
    );
    expect(memberPost.status).toBe(403);

    // 3. Admin cookie passes middleware and enforces 415/403 CSRF guards on POST
    const adminCookie = await encryptSession(makeSession('secondadmin@example.com', 'u-admin'), TEST_SECRET);
    activeCookieToken = adminCookie;
    const mwAdmin = await middleware(
      new NextRequest('https://calendai.tduong.online/admin', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminCookie}` },
      })
    );
    expect(mwAdmin.status).toBe(200);

    const wrongTypeRes = await POST(
      new Request('https://calendai.tduong.online/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({ primaryModel: 'provider/a', fallbackModel: null }),
      })
    );
    expect(wrongTypeRes.status).toBe(415);

    const crossOriginRes = await POST(
      new Request('https://calendai.tduong.online/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.example',
          'Sec-Fetch-Site': 'cross-site',
        },
        body: JSON.stringify({ primaryModel: 'provider/a', fallbackModel: null }),
      })
    );
    expect(crossOriginRes.status).toBe(403);
  });

  it('validates catalog and duplicates, persists config to JSON + cache, and syncs probe/models/chat', async () => {
    activeCookieToken = await encryptSession(makeSession('admin@example.com', 'u-admin'), TEST_SECRET);
    const { GET, POST } = await import('@/app/api/admin/config/route');
    const { resetAdminModelConfigCache, getAdminModelConfig } = await import('@/lib/ai/admin-config');
    const { getChatModel } = await import('@/lib/ai/provider');

    // Initial config falls back to env
    const initialGet = await GET(new Request('https://calendai.tduong.online/api/admin/config'));
    expect(initialGet.status).toBe(200);
    expect(await initialGet.json()).toMatchObject({
      primaryModel: 'provider/env-primary',
      fallbackModel: 'provider/env-fallback',
      isAdmin: true,
    });

    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [
          { id: 'provider/new-primary', name: 'New Primary' },
          { id: 'provider/new-fallback', name: 'New Fallback' },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    // Duplicate primary & fallback -> 400
    const dupRes = await POST(
      new Request('https://calendai.tduong.online/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({
          primaryModel: 'provider/new-primary',
          fallbackModel: 'provider/new-primary',
        }),
      })
    );
    expect(dupRes.status).toBe(400);

    // Unknown primary -> 400
    const unknownPrimaryRes = await POST(
      new Request('https://calendai.tduong.online/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({
          primaryModel: 'provider/not-in-catalog',
          fallbackModel: 'provider/new-fallback',
        }),
      })
    );
    expect(unknownPrimaryRes.status).toBe(400);

    // Unknown fallback -> 400
    const unknownFallbackRes = await POST(
      new Request('https://calendai.tduong.online/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({
          primaryModel: 'provider/new-primary',
          fallbackModel: 'provider/not-in-catalog',
        }),
      })
    );
    expect(unknownFallbackRes.status).toBe(400);

    // Valid save -> 200 and writes JSON file
    const saveRes = await POST(
      new Request('https://calendai.tduong.online/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({
          primaryModel: 'provider/new-primary',
          fallbackModel: 'provider/new-fallback',
        }),
      })
    );
    expect(saveRes.status).toBe(200);
    expect(fs.existsSync(configPath)).toBe(true);
    expect(getAdminModelConfig()).toMatchObject({
      primaryModel: 'provider/new-primary',
      fallbackModel: 'provider/new-fallback',
    });
    expect(getChatModel().modelId).toBe('provider/new-primary');

    // Clear in-memory cache and verify reading back from disk
    resetAdminModelConfigCache();
    expect(getAdminModelConfig()).toMatchObject({
      primaryModel: 'provider/new-primary',
      fallbackModel: 'provider/new-fallback',
    });

    // Clearing fallback (null) persists cleanly
    const clearFallbackRes = await POST(
      new Request('https://calendai.tduong.online/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({
          primaryModel: 'provider/new-primary',
          fallbackModel: null,
        }),
      })
    );
    expect(clearFallbackRes.status).toBe(200);
    expect(getAdminModelConfig().fallbackModel).toBeNull();

    // GET /api/models reflects updated defaultModel
    const modelsRoute = await import('@/app/api/models/route');
    const modelsRes = await modelsRoute.GET();
    const modelsJson = await modelsRes.json();
    expect(modelsJson.defaultModel).toBe('provider/new-primary');

    // Catalog failure -> 503
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'down' }, { status: 502 }));
    const catalogErrRes = await POST(
      new Request('https://calendai.tduong.online/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({
          primaryModel: 'provider/new-primary',
          fallbackModel: null,
        }),
      })
    );
    expect(catalogErrRes.status).toBe(503);
  });

  it('ignores client-sent model in POST /api/chat and falls back once on 500/429/timeout, returning 503 if both fail', async () => {
    const { saveAdminModelConfig } = await import('@/lib/ai/admin-config');
    saveAdminModelConfig({
      primaryModel: 'provider/admin-primary',
      fallbackModel: 'provider/admin-fallback',
      updatedBy: 'admin@example.com',
    });

    const requestedModels: string[] = [];
    let mode:
      | 'primary-ok'
      | 'primary-500-fallback-ok'
      | 'primary-429-fallback-ok'
      | 'primary-timeout-fallback-ok'
      | 'both-500' = 'primary-ok';

    vi.doMock('@/lib/ai/provider', () => ({
      getChatModel: (modelId?: string) => {
        const resolved = modelId?.trim() || 'provider/admin-primary';
        requestedModels.push(resolved);
        if (resolved === 'provider/admin-primary') {
          if (mode === 'primary-ok') return makeSuccessModel('Phản hồi từ model chính');
          if (mode === 'primary-500-fallback-ok' || mode === 'both-500') {
            return makeHttpErrorModel(500, 'upstream-secret-500');
          }
          if (mode === 'primary-429-fallback-ok') {
            return makeHttpErrorModel(429, 'rate-limit-secret');
          }
          if (mode === 'primary-timeout-fallback-ok') {
            return makeTimeoutErrorModel();
          }
        }
        if (resolved === 'provider/admin-fallback') {
          if (mode === 'both-500') return makeHttpErrorModel(502, 'fallback-secret-502');
          return makeSuccessModel('Phản hồi từ model dự phòng');
        }
        throw new Error(`Unexpected model requested: ${resolved}`);
      },
    }));

    const { POST } = await import('@/app/api/chat/route');
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const makeChatReq = (clientModel?: string, signal?: AbortSignal) =>
      new Request('https://calendai.tduong.online/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        signal,
        body: JSON.stringify({
          ...(clientModel ? { model: clientModel } : {}),
          messages: [{ role: 'user', content: 'Xin chào' }],
        }),
      });

    // 1. Client tries to override model with expensive/unknown ID -> ignored, uses admin-primary
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res1 = await POST(makeChatReq('openai/expensive-hijack-model'));
    expect(res1.status).toBe(200);
    const text1 = await res1.text();
    expect(text1).toContain('Phản hồi từ model chính');
    expect(text1).not.toContain('provider/admin-primary');
    expect(requestedModels).toEqual(['provider/admin-primary']);
    expect(fetchSpy).not.toHaveBeenCalled();

    // 2. Primary returns 500 -> retries exactly once with fallback
    requestedModels.length = 0;
    mode = 'primary-500-fallback-ok';
    const res2 = await POST(makeChatReq());
    expect(res2.status).toBe(200);
    const text2 = await res2.text();
    expect(text2).toContain('Phản hồi từ model dự phòng');
    expect(text2).not.toContain('provider/admin-fallback');
    expect(requestedModels).toEqual(['provider/admin-primary', 'provider/admin-fallback']);

    // 3. Primary returns 429 -> retries exactly once with fallback
    requestedModels.length = 0;
    mode = 'primary-429-fallback-ok';
    const res3 = await POST(makeChatReq());
    expect(res3.status).toBe(200);
    expect(await res3.text()).toContain('Phản hồi từ model dự phòng');
    expect(requestedModels).toEqual(['provider/admin-primary', 'provider/admin-fallback']);

    // 4. Primary times out -> retries exactly once with fallback
    requestedModels.length = 0;
    mode = 'primary-timeout-fallback-ok';
    const res4 = await POST(makeChatReq());
    expect(res4.status).toBe(200);
    expect(await res4.text()).toContain('Phản hồi từ model dự phòng');
    expect(requestedModels).toEqual(['provider/admin-primary', 'provider/admin-fallback']);

    // 5. Both primary & fallback fail -> 503 Vietnamese message without raw upstream diagnostics
    requestedModels.length = 0;
    mode = 'both-500';
    const res5 = await POST(makeChatReq());
    expect(res5.status).toBe(503);
    const body5 = await res5.text();
    expect(body5).not.toContain('upstream-secret-500');
    expect(body5).not.toContain('fallback-secret-502');
    expect(JSON.parse(body5).error).toMatch(/quá tải|không phản hồi|thử lại/i);
    expect(requestedModels).toEqual(['provider/admin-primary', 'provider/admin-fallback']);

    // 6. Client aborts request -> does not retry with fallback
    requestedModels.length = 0;
    mode = 'primary-500-fallback-ok';
    const abortController = new AbortController();
    abortController.abort();
    const res6 = await POST(makeChatReq(undefined, abortController.signal));
    expect(res6.status).toBe(500);
    expect(requestedModels).toEqual(['provider/admin-primary']);

    // Server logged served models
    expect(infoSpy).toHaveBeenCalledWith('[chat] model served:', 'provider/admin-primary');
    expect(infoSpy).toHaveBeenCalledWith('[chat] model served (fallback):', 'provider/admin-fallback');

    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('syncs /api/health/ai/probe with the admin-selected primary model', async () => {
    const { saveAdminModelConfig } = await import('@/lib/ai/admin-config');
    saveAdminModelConfig({
      primaryModel: 'provider/probe-primary',
      fallbackModel: 'provider/probe-fallback',
      updatedBy: 'admin@example.com',
    });

    const seenModels: string[] = [];
    vi.doMock('ai', async (importOriginal) => {
      const actual = await importOriginal<typeof import('ai')>();
      return {
        ...actual,
        generateText: vi.fn(async ({ model }: { model: { modelId: string } }) => {
          seenModels.push(model.modelId);
          return { text: 'OK' };
        }),
      };
    });

    const { GET } = await import('@/app/api/health/ai/probe/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(seenModels).toEqual(['provider/probe-primary']);
  });

  it('aborts hanging primary doStream on start timeout and succeeds on fallback', async () => {
    const { saveAdminModelConfig } = await import('@/lib/ai/admin-config');
    saveAdminModelConfig({
      primaryModel: 'provider/hanging-primary',
      fallbackModel: 'provider/healthy-fallback',
      updatedBy: 'admin@example.com',
    });

    let primarySignal: AbortSignal | undefined;
    const requestedModels: string[] = [];

    vi.doMock('@/lib/ai/provider', () => ({
      getChatModel: (modelId?: string) => {
        const resolved = modelId?.trim() || 'provider/hanging-primary';
        requestedModels.push(resolved);
        if (resolved === 'provider/hanging-primary') {
          return new MockLanguageModelV1({
            doStream: async ({ abortSignal }) => {
              primarySignal = abortSignal;
              return new Promise((_, reject) => {
                abortSignal?.addEventListener(
                  'abort',
                  () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
                  { once: true }
                );
              });
            },
          });
        }
        return makeSuccessModel('Phản hồi từ fallback sau timeout');
      },
    }));

    const { POST } = await import('@/app/api/chat/route');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    vi.useFakeTimers();
    try {
      const responsePromise = POST(
        new Request('https://calendai.tduong.online/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://calendai.tduong.online',
            'Sec-Fetch-Site': 'same-origin',
          },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'Xin chào' }] }),
        })
      );

      await vi.advanceTimersByTimeAsync(25_000);
      const response = await responsePromise;
      expect(response.status).toBe(200);
      expect(primarySignal).toBeInstanceOf(AbortSignal);
      expect(primarySignal?.aborted).toBe(true);
      expect(requestedModels).toEqual(['provider/hanging-primary', 'provider/healthy-fallback']);
      expect(await response.text()).toContain('Phản hồi từ fallback sau timeout');
    } finally {
      vi.useRealTimers();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    }
  });

  it('aborts primary and retries fallback when a 3: error frame is split across chunks after f: header', async () => {
    const { saveAdminModelConfig } = await import('@/lib/ai/admin-config');
    saveAdminModelConfig({
      primaryModel: 'provider/split-error-primary',
      fallbackModel: 'provider/split-error-fallback',
      updatedBy: 'admin@example.com',
    });

    const requestedModels: string[] = [];
    let primarySignal: AbortSignal | undefined;

    vi.doMock('ai', async (importOriginal) => {
      const actual = await importOriginal<typeof import('ai')>();
      return {
        ...actual,
        streamText: vi.fn(
          ({
            model,
            abortSignal,
          }: {
            model: { modelId: string };
            abortSignal?: AbortSignal;
          }) => {
            requestedModels.push(model.modelId);
            if (model.modelId === 'provider/split-error-primary') {
              primarySignal = abortSignal;
              return {
                toDataStreamResponse: ({
                  getErrorMessage,
                }: {
                  getErrorMessage?: (err: unknown) => string;
                }) => {
                  const encoder = new TextEncoder();
                  return new Response(
                    new ReadableStream<Uint8Array>({
                      start(controller) {
                        controller.enqueue(encoder.encode('f:{"messageId":"m1"}\n'));
                        controller.enqueue(encoder.encode('3'));
                        getErrorMessage?.(
                          new APICallError({
                            message: 'upstream-split-500',
                            url: 'https://api.example.test/v1/chat/completions',
                            requestBodyValues: {},
                            statusCode: 500,
                            responseHeaders: {},
                            responseBody: 'error',
                            isRetryable: true,
                          })
                        );
                        controller.enqueue(encoder.encode(':"Không thể nhận phản hồi"\n'));
                        controller.close();
                      },
                    })
                  );
                },
              };
            }
            return {
              toDataStreamResponse: () =>
                new Response('0:"Phản hồi từ fallback sau split 3:"\n', {
                  headers: { 'Content-Type': 'text/plain', 'x-vercel-ai-data-stream': 'v1' },
                }),
            };
          }
        ),
      };
    });

    vi.doMock('@/lib/ai/provider', () => ({
      getChatModel: (modelId?: string) => ({ modelId: modelId?.trim() || 'provider/split-error-primary' }),
    }));

    const { POST } = await import('@/app/api/chat/route');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    try {
      const response = await POST(
        new Request('https://calendai.tduong.online/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://calendai.tduong.online',
            'Sec-Fetch-Site': 'same-origin',
          },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'Xin chào' }] }),
        })
      );

      expect(response.status).toBe(200);
      expect(primarySignal?.aborted).toBe(true);
      expect(requestedModels).toEqual([
        'provider/split-error-primary',
        'provider/split-error-fallback',
      ]);
      expect(await response.text()).toContain('Phản hồi từ fallback sau split 3:');
    } finally {
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    }
  });

  it('keys the 60s /api/health/ai/probe cache by active primaryModel so admin updates probe immediately', async () => {
    const { saveAdminModelConfig } = await import('@/lib/ai/admin-config');
    saveAdminModelConfig({
      primaryModel: 'provider/probe-a',
      fallbackModel: null,
      updatedBy: 'admin@example.com',
    });

    const seenModels: string[] = [];
    vi.doMock('ai', async (importOriginal) => {
      const actual = await importOriginal<typeof import('ai')>();
      return {
        ...actual,
        generateText: vi.fn(async ({ model }: { model: { modelId: string } }) => {
          seenModels.push(model.modelId);
          return { text: 'OK' };
        }),
      };
    });

    const { GET } = await import('@/app/api/health/ai/probe/route');
    expect((await GET()).status).toBe(200);
    expect(seenModels).toEqual(['provider/probe-a']);

    // Switch primary model immediately -> probe must not return stale probe-a cache
    saveAdminModelConfig({
      primaryModel: 'provider/probe-b',
      fallbackModel: null,
      updatedBy: 'admin@example.com',
    });

    expect((await GET()).status).toBe(200);
    expect(seenModels).toEqual(['provider/probe-a', 'provider/probe-b']);

    // Second call with probe-b hits probe-b's 60s cache
    expect((await GET()).status).toBe(200);
    expect(seenModels).toEqual(['provider/probe-a', 'provider/probe-b']);
  });

  it('uses os.tmpdir() for Vercel tmp fallback and does not shadow an explicit ADMIN_CONFIG_PATH', async () => {
    const tmpFallbackFile = path.join(os.tmpdir(), 'calendai-admin-config.json');
    fs.rmSync(tmpFallbackFile, { force: true });

    try {
      vi.stubEnv('VERCEL', '1');
      vi.stubEnv('ADMIN_CONFIG_PATH', '');

      const { getAdminModelConfig, resolveAdminConfigPath, saveAdminModelConfig } = await import(
        '@/lib/ai/admin-config'
      );

      expect(resolveAdminConfigPath()).toBe(path.join(os.tmpdir(), 'calendai-admin-config.json'));
      saveAdminModelConfig({
        primaryModel: 'provider/tmp-model',
        fallbackModel: null,
        updatedBy: 'admin@example.com',
      });
      expect(fs.existsSync(tmpFallbackFile)).toBe(true);
      expect(getAdminModelConfig().primaryModel).toBe('provider/tmp-model');

      // Setting an explicit ADMIN_CONFIG_PATH without resetting cache must not be shadowed by tmp cache
      const explicitPath = path.join(tempDir, 'explicit-admin-config.json');
      fs.writeFileSync(
        explicitPath,
        JSON.stringify({ primaryModel: 'provider/explicit-model', fallbackModel: null })
      );
      vi.stubEnv('ADMIN_CONFIG_PATH', explicitPath);

      expect(getAdminModelConfig().primaryModel).toBe('provider/explicit-model');
    } finally {
      fs.rmSync(tmpFallbackFile, { force: true });
    }
  });
});
