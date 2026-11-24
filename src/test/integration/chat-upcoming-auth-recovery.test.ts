// @vitest-environment node
import { parseDataStreamPart, simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptMobileSession, encryptSession, SESSION_EXPIRATION_SECONDS } from '@/lib/auth/session';
import type { MobileSessionData, SessionData } from '@/lib/auth/types';
import { resetChatRateLimit } from '@/lib/chat/rate-limit';

const cookieMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));
const modelMock = vi.hoisted(() => ({
  getChatModel: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieMocks),
}));
vi.mock('@/lib/ai/provider', () => ({
  getChatModel: modelMock.getChatModel,
}));

import { POST } from '@/app/api/chat/route';

const SESSION_KEY = 'test-key-1234567890-abcdefghijklmnopqrstuvwxyz';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

function createLookupStreamModel(onStepTwoPrompt?: (prompt: Parameters<MockLanguageModelV1['doStream']>[0]['prompt']) => void) {
  let step = 0;
  return new MockLanguageModelV1({
    doStream: async (options) => {
      step += 1;
      if (step === 1) {
        return {
          stream: simulateReadableStream({
            chunks: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-upcoming-1',
                toolName: 'listUpcomingEvents',
                args: JSON.stringify({ range: 'today' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { promptTokens: 20, completionTokens: 10 },
              },
            ],
            initialDelayInMs: null,
            chunkDelayInMs: null,
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }

      onStepTwoPrompt?.(options.prompt);
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: 'Đã hoàn tất kiểm tra lịch hôm nay.' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 30, completionTokens: 12 },
            },
          ],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

function parseToolResultsFromStream(streamTextBody: string): Array<{ toolCallId: string; result: unknown }> {
  return streamTextBody
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseDataStreamPart(line))
    .filter((part): part is { type: 'tool_result'; value: { toolCallId: string; result: unknown } } => part.type === 'tool_result')
    .map((part) => part.value);
}

describe('POST /api/chat listUpcomingEvents 401 recovery & guidance (#74)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChatRateLimit();
    vi.stubEnv('AI_API_KEY', 'test-ai-key');
    vi.stubEnv('AI_MODEL', 'test-chat-model');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'web-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'web-client-secret');
    vi.stubEnv('SESSION_SECRET', SESSION_KEY);
    cookieMocks.get.mockReturnValue(undefined);
    cookieMocks.set.mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('refreshes Web token mid-stream when Google Calendar returns 401 even if cookies().set throws after response headers are flushed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T02:00:00Z')); // 09:00 GMT+7

    const webSession: SessionData = {
      user: { id: 'web-u1', email: 'web@example.com', name: 'Người dùng Web' },
      tokens: {
        accessToken: 'early-revoked-access',
        refreshToken: 'valid-refresh-token',
        expiresAt: Date.now() + 45 * 60 * 1000, // > 5 min so pre-stream getValidAccessToken does not refresh
        tokenType: 'Bearer',
        scope: CALENDAR_SCOPE,
      },
      createdAt: Date.now(),
    };
    cookieMocks.get.mockReturnValue({ value: await encryptSession(webSession, SESSION_KEY) });

    // Simulate Next.js App Router throwing when cookies().set() is called inside a streaming tool callback
    cookieMocks.set.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler.');
    });

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({
          access_token: 'midstream-fresh-access',
          refresh_token: 'valid-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: CALENDAR_SCOPE,
        });
      }
      const auth = new Headers(init?.headers).get('Authorization');
      if (auth === 'Bearer early-revoked-access') {
        return Response.json({ error: { code: 401, message: 'Invalid Credentials' } }, { status: 401 });
      }
      if (auth === 'Bearer midstream-fresh-access') {
        return Response.json({
          items: [
            {
              id: 'evt-today-1',
              summary: 'Họp giao ban sáng',
              start: { dateTime: '2026-11-24T10:00:00+07:00' },
              end: { dateTime: '2026-11-24T10:30:00+07:00' },
            },
          ],
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    modelMock.getChatModel.mockReturnValue(createLookupStreamModel());

    const response = await POST(
      new Request('https://calendai.tduong.online/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hôm nay tôi có lịch gì không?' }],
        }),
      })
    );

    expect(response.status).toBe(200);
    const streamBody = await response.text();
    expect(streamBody).toContain('Đã hoàn tất kiểm tra lịch hôm nay.');

    const toolResults = parseToolResultsFromStream(streamBody);
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0].result).toMatchObject({
      success: true,
      mode: 'google',
      events: [expect.objectContaining({ id: 'evt-today-1', summary: 'Họp giao ban sáng' })],
    });
    expect(cookieMocks.set).toHaveBeenCalledOnce();

    // Also verify cookie persistence succeeds cleanly when cookies().set() is writable
    cookieMocks.set.mockClear();
    cookieMocks.set.mockImplementation(() => undefined);
    modelMock.getChatModel.mockReturnValue(createLookupStreamModel());
    const writableCookieRes = await POST(
      new Request('https://calendai.tduong.online/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Kiểm tra lại lịch hôm nay' }],
        }),
      })
    );
    expect(writableCookieRes.status).toBe(200);
    expect(parseToolResultsFromStream(await writableCookieRes.text())[0].result).toMatchObject({
      success: true,
      mode: 'google',
    });
    expect(cookieMocks.set).toHaveBeenCalledOnce();
  });

  it('returns google_reauthorization_required instead of "Chưa kết nối tài khoản Google" when pre-stream Web token refresh fails', async () => {
    const expiredWebSession: SessionData = {
      user: { id: 'web-u2', email: 'web2@example.com', name: 'Người dùng Web 2' },
      tokens: {
        accessToken: 'expired-access',
        refreshToken: 'revoked-refresh-token',
        expiresAt: Date.now() - 60_000, // Expired -> pre-stream getValidAccessToken runs and fails
        tokenType: 'Bearer',
        scope: CALENDAR_SCOPE,
      },
      createdAt: Date.now() - 3600_000,
    };
    cookieMocks.get.mockReturnValue({ value: await encryptSession(expiredWebSession, SESSION_KEY) });

    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json(
          { error: 'invalid_grant', error_description: 'revoked-grant-secret' },
          { status: 400 }
        );
      }
      throw new Error(`Unexpected Calendar call: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    modelMock.getChatModel.mockReturnValue(createLookupStreamModel());

    const response = await POST(
      new Request('https://calendai.tduong.online/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://calendai.tduong.online',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Xem lịch hôm nay' }],
        }),
      })
    );

    expect(response.status).toBe(200);
    const streamBody = await response.text();
    const toolResults = parseToolResultsFromStream(streamBody);
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0].result).toMatchObject({
      success: false,
      code: 'google_reauthorization_required',
    });
    expect(JSON.stringify(toolResults[0].result)).not.toContain('Chưa kết nối tài khoản Google');
    expect(JSON.stringify(toolResults[0].result)).not.toContain('revoked-grant-secret');
  });

  it('returns SESSION_REFRESH_REQUIRED without server refresh or mock fallback when Mobile Bearer encounters 401 in listUpcomingEvents', async () => {
    const now = Date.now();
    const mobileSession: MobileSessionData = {
      kind: 'mobile',
      createdAt: now,
      expiresAt: now + SESSION_EXPIRATION_SECONDS * 1000,
      user: { id: 'mob-u1', email: 'mobile@example.com', name: 'Người dùng Mobile' },
      tokens: {
        accessToken: 'early-revoked-mobile-access',
        refreshToken: 'mobile-refresh-grant',
        expiresAt: now + 30 * 60 * 1000, // Valid pre-stream so stream starts
        tokenType: 'Bearer',
        scope: CALENDAR_SCOPE,
      },
    };
    const bearer = await encryptMobileSession(mobileSession, SESSION_KEY);

    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ error: { code: 401, message: 'Google Mobile 401 Diagnostic' } }, { status: 401 })
    );
    vi.stubGlobal('fetch', fetchMock);
    modelMock.getChatModel.mockReturnValue(createLookupStreamModel());

    const response = await POST(
      new Request('https://calendai.tduong.online/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Xem lịch hôm nay' }],
        }),
      })
    );

    expect(response.status).toBe(200);
    const streamBody = await response.text();
    const toolResults = parseToolResultsFromStream(streamBody);
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0].result).toMatchObject({
      success: false,
      code: 'SESSION_REFRESH_REQUIRED',
    });
    expect(JSON.stringify(toolResults[0].result)).not.toContain('Google Mobile 401 Diagnostic');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('oauth2.googleapis.com'))).toBe(false);
    expect(cookieMocks.set).not.toHaveBeenCalled();
  });
});
