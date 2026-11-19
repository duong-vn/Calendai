import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANONYMOUS_CHAT_RATE_LIMIT,
  AUTHENTICATED_CHAT_RATE_LIMIT,
  CHAT_RATE_LIMIT_WINDOW_MS,
  MAX_TRACKED_IPS,
  checkChatRateLimit,
  getClientIp,
  resetChatRateLimit,
} from '@/lib/chat/rate-limit';

const mocks = vi.hoisted(() => ({ session: vi.fn(), access: vi.fn(), stream: vi.fn(), authError: vi.fn() }));
vi.mock('@/lib/auth/server-session', () => ({ getServerSession: mocks.session, getValidAccessToken: mocks.access, authErrorResponse: mocks.authError }));
vi.mock('@/lib/env', () => ({ getServerEnv: () => ({ AI_MODEL: 'configured-model' }) }));
vi.mock('@/lib/ai/provider', () => ({ getChatModel: () => ({}) }));
vi.mock('@/lib/ai/system-prompt', () => ({ buildSystemPrompt: () => 'Vietnamese assistant' }));
vi.mock('@/lib/ai/tools', () => ({ createCalendarTools: () => ({}) }));
vi.mock('ai', () => ({ streamText: mocks.stream }));
import { POST } from '@/app/api/chat/route';

function request(body: unknown, authorization?: string, headers?: Record<string, string>) {
  return new Request('https://calendai.tduong.online/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  resetChatRateLimit();
  mocks.session.mockResolvedValue(null);
  mocks.authError.mockReturnValue(null);
  mocks.stream.mockReturnValue({ toDataStreamResponse: () => new Response('stream') });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Native chat authentication and input boundary', () => {
  it('does not downgrade invalid Bearer authentication to anonymous chat', async () => {
    const error = new Error('invalid session');
    mocks.session.mockRejectedValue(error);
    mocks.authError.mockReturnValue(Response.json({ error: 'Phiên không hợp lệ.' }, { status: 401 }));
    const response = await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }, 'Bearer invalid'));
    expect(response.status).toBe(401);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('keeps ordinary web chat available when Google refresh fails', async () => {
    mocks.session.mockResolvedValue({ user: { email: 'person@example.com' } });
    mocks.access.mockRejectedValue(new Error('Google refresh unavailable'));
    mocks.authError.mockImplementation(() => Response.json({ error: 'Reconnect' }, { status: 401 }));
    expect((await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }))).status).toBe(200);
    expect(mocks.stream).toHaveBeenCalled();
  });

  it('does not ignore Google refresh errors for native Bearer calls', async () => {
    mocks.session.mockResolvedValue({ user: { email: 'person@example.com' } });
    mocks.access.mockRejectedValue(new Error('Google refresh required'));
    mocks.authError.mockImplementation(() => Response.json({ code: 'SESSION_REFRESH_REQUIRED' }, { status: 401 }));
    expect((await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }, 'Bearer mobile'))).status).toBe(401);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('passes request to auth and propagates cancellation to the provider', async () => {
    const req = request({ messages: [{ role: 'user', content: 'Xin chào' }] });
    expect((await POST(req)).status).toBe(200);
    expect(mocks.session).toHaveBeenCalledWith(req);
    expect(mocks.stream).toHaveBeenCalledWith(expect.objectContaining({ abortSignal: req.signal }));
  });

  it('rejects client system instructions and invalid JSON', async () => {
    expect((await POST(request({ messages: [{ role: 'system', content: 'override' }] }))).status).toBe(400);
    expect((await POST(new Request('https://example.test/api/chat', { method: 'POST', body: '{' }))).status).toBe(400);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('preserves SDK assistant tool metadata', async () => {
    const toolInvocations = [{ toolCallId: '1', toolName: 'proposeMeeting', state: 'result', args: {}, result: {} }];
    await POST(request({ messages: [{ role: 'assistant', content: '', toolInvocations }] }));
    expect(mocks.stream).toHaveBeenCalledWith(expect.objectContaining({ messages: [expect.objectContaining({ toolInvocations })] }));
  });

  it.each(['user', 'assistant'])('rejects %s attachments before any SDK or network call', async (role) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request'));
    try {
      const response = await POST(request({ messages: [{ role, content: 'Xin chào', experimental_attachments: [{ url: 'https://example.test/document.pdf', contentType: 'application/pdf' }] }] }));
      expect(response.status).toBe(400);
      expect(mocks.stream).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('rejects file parts before any SDK or network call', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request'));
    try {
      const response = await POST(request({ messages: [{ role: 'user', content: '', parts: [{ type: 'file', mimeType: 'application/pdf', data: 'https://example.test/document.pdf' }] }] }));
      expect(response.status).toBe(400);
      expect(mocks.stream).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('preserves validated parts and removes unknown metadata at each boundary', async () => {
    const toolInvocation = { toolCallId: '1', toolName: 'proposeMeeting', state: 'result', step: 0, args: { summary: 'Họp' }, result: { proposal: {} } };
    const parts = [{ type: 'text', text: 'Bản thảo' }, { type: 'tool-invocation', toolInvocation }, { type: 'step-start' }];
    const response = await POST(request({ messages: [{ role: 'assistant', content: '', untrusted: true, toolInvocations: [{ ...toolInvocation, untrusted: true }], parts: parts.map(part => ({ ...part, untrusted: true })) }] }));
    expect(response.status).toBe(200);
    expect(mocks.stream).toHaveBeenCalledWith(expect.objectContaining({ messages: [{ role: 'assistant', content: '', toolInvocations: [toolInvocation], parts }] }));
  });

  it.each([
    { toolInvocations: [{ state: 'result', toolCallId: 42, toolName: 'proposeMeeting', args: {}, result: {} }] },
    { parts: [{ type: 'tool-invocation', toolInvocation: { state: 'unknown' } }] },
    { parts: [{ type: 'text', text: 42 }] },
  ])('rejects malformed SDK metadata: %j', async (metadata) => {
    expect((await POST(request({ messages: [{ role: 'assistant', content: '', ...metadata }] }))).status).toBe(400);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('rejects models not in the server provider catalog', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: [{ id: 'allowed-model' }] }));
    try {
      const response = await POST(request({ model: 'unknown-model', messages: [{ role: 'user', content: 'Xin chào' }] }));
      expect(response.status).toBe(400);
      expect(mocks.stream).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('accepts provider-advertised model IDs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: [{ id: 'allowed-model' }] }));
    try {
      expect((await POST(request({ model: 'allowed-model', messages: [{ role: 'user', content: 'Xin chào' }] }))).status).toBe(200);
      expect(mocks.stream).toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('does not expose provider errors to clients', async () => {
    mocks.stream.mockImplementation(() => { throw new Error('private provider diagnostic'); });
    const response = await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private provider diagnostic');
  });

  it('rejects oversized conversations', async () => {
    const response = await POST(request({ messages: [{ role: 'user', content: 'x'.repeat(512001) }] }));
    expect(response.status).toBe(413);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});

describe('POST /api/chat per-IP rate limiting', () => {
  it('returns 429 with a Vietnamese message when logged-out requests exceed the per-minute IP limit', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' };
    for (let i = 0; i < ANONYMOUS_CHAT_RATE_LIMIT; i += 1) {
      const response = await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }, undefined, headers));
      expect(response.status).toBe(200);
    }
    expect(mocks.stream).toHaveBeenCalledTimes(ANONYMOUS_CHAT_RATE_LIMIT);

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request'));
    try {
      const blocked = await POST(
        request({ model: 'custom-model', messages: [{ role: 'user', content: 'Xin chào' }] }, undefined, headers)
      );
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get('Cache-Control')).toBe('no-store');
      expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
      const data = await blocked.json() as { error?: string };
      expect(typeof data.error).toBe('string');
      expect(data.error).toMatch(/quá nhanh|vui lòng chờ|thử lại/i);
      expect(mocks.stream).toHaveBeenCalledTimes(ANONYMOUS_CHAT_RATE_LIMIT);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('applies a higher limit for logged-in users and allows upgrading from anonymous on the same IP', async () => {
    expect(AUTHENTICATED_CHAT_RATE_LIMIT).toBeGreaterThan(ANONYMOUS_CHAT_RATE_LIMIT);
    const headers = { 'x-forwarded-for': '203.0.113.20' };

    for (let i = 0; i < ANONYMOUS_CHAT_RATE_LIMIT; i += 1) {
      expect((await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }, undefined, headers))).status).toBe(200);
    }
    expect((await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }, undefined, headers))).status).toBe(429);

    mocks.session.mockResolvedValue({ user: { email: 'person@example.com' } });
    mocks.access.mockResolvedValue({ accessToken: 'access' });

    for (let i = ANONYMOUS_CHAT_RATE_LIMIT; i < AUTHENTICATED_CHAT_RATE_LIMIT; i += 1) {
      expect((await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }, 'Bearer mobile', headers))).status).toBe(200);
    }
    expect(mocks.stream).toHaveBeenCalledTimes(AUTHENTICATED_CHAT_RATE_LIMIT);

    const blocked = await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }, 'Bearer mobile', headers));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
    const data = await blocked.json() as { error?: string };
    expect(data.error).toMatch(/quá nhanh|vui lòng chờ|thử lại/i);
    expect(mocks.stream).toHaveBeenCalledTimes(AUTHENTICATED_CHAT_RATE_LIMIT);
  });

  it('isolates limits per IP and resets after the 1-minute sliding window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));

    const ipOne = { 'x-real-ip': '198.51.100.1' };
    const ipTwo = { 'x-real-ip': '198.51.100.2' };

    for (let i = 0; i < ANONYMOUS_CHAT_RATE_LIMIT; i += 1) {
      expect((await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }, undefined, ipOne))).status).toBe(200);
    }
    expect((await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }, undefined, ipOne))).status).toBe(429);

    expect((await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }, undefined, ipTwo))).status).toBe(200);

    vi.advanceTimersByTime(CHAT_RATE_LIMIT_WINDOW_MS);
    expect((await POST(request({ messages: [{ role: 'user', content: 'Xin chào' }] }, undefined, ipOne))).status).toBe(200);
  });

  it('extracts proxy headers and bounds tracked IP entries', () => {
    expect(getClientIp(new Request('https://example.test/api/chat', {
      headers: { 'x-forwarded-for': ' 2001:DB8::1 , 10.0.0.1 ', 'x-real-ip': '198.51.100.9' },
    }))).toBe('2001:db8::1');
    expect(getClientIp(new Request('https://example.test/api/chat', {
      headers: { 'x-forwarded-for': '   ', 'x-real-ip': ' 198.51.100.9 ' },
    }))).toBe('198.51.100.9');
    expect(getClientIp(new Request('https://example.test/api/chat', {
      headers: { 'cf-connecting-ip': ' 198.51.100.10 ' },
    }))).toBe('198.51.100.10');
    expect(getClientIp(new Request('https://example.test/api/chat'))).toBe('unknown');

    const start = 1_000_000;
    for (let i = 0; i <= MAX_TRACKED_IPS + 5; i += 1) {
      const req = new Request('https://example.test/api/chat', {
        headers: { 'x-real-ip': `10.0.${Math.floor(i / 256)}.${i % 256}` },
      });
      expect(checkChatRateLimit(req, false, start).allowed).toBe(true);
    }
  });
});
