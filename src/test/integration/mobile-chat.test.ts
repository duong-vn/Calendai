import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: vi.fn(), access: vi.fn(), stream: vi.fn(), authError: vi.fn() }));
vi.mock('@/lib/auth/server-session', () => ({ getServerSession: mocks.session, getValidAccessToken: mocks.access, authErrorResponse: mocks.authError }));
vi.mock('@/lib/env', () => ({ getServerEnv: () => ({ AI_MODEL: 'configured-model' }) }));
vi.mock('@/lib/ai/provider', () => ({ getChatModel: () => ({}) }));
vi.mock('@/lib/ai/system-prompt', () => ({ buildSystemPrompt: () => 'Vietnamese assistant' }));
vi.mock('@/lib/ai/tools', () => ({ createCalendarTools: () => ({}) }));
vi.mock('ai', () => ({ streamText: mocks.stream }));
import { POST } from '@/app/api/chat/route';

function request(body: unknown, authorization?: string) {
  return new Request('https://calendai.tduong.online/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.authError.mockReturnValue(null);
  mocks.stream.mockReturnValue({ toDataStreamResponse: () => new Response('stream') });
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
