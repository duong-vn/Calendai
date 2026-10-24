import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as exchange } from '@/app/api/auth/mobile/exchange/route';
import { POST as refresh } from '@/app/api/auth/mobile/refresh/route';
import { GET as status } from '@/app/api/auth/google/status/route';
import { POST as logout } from '@/app/api/auth/google/logout/route';
import { AuthError, authErrorResponse, getServerSession, getValidAccessToken } from '../server-session';
import { decryptMobileSession, encryptMobileSession, encryptSession, SESSION_EXPIRATION_SECONDS } from '../session';
import { EnvSchema } from '../../env';
import type { MobileSessionData, SessionData } from '../types';

const cookieMocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieMocks) }));

const key = 'test-key-1234567890-abcdefghijklmnopqrstuvwxyz';
const scope = 'https://www.googleapis.com/auth/calendar.events';

function sampleSession(): MobileSessionData {
  const now = Date.now();
  return {
    kind: 'mobile', createdAt: now, expiresAt: now + SESSION_EXPIRATION_SECONDS * 1000,
    user: { id: 'google-user', email: 'user@example.com', name: 'Người dùng' },
    tokens: { accessToken: 'google-access', refreshToken: 'google-refresh', tokenType: 'Bearer', expiresAt: now + 3600000, scope },
  };
}

async function bearerRequest(path: string, session = sampleSession(), method = 'POST') {
  return new Request(`https://app.example.com${path}`, {
    method, headers: { Authorization: `Bearer ${await encryptMobileSession(session, key)}` },
  });
}

function exchangeRequest(body: unknown) {
  return new Request('https://app.example.com/api/auth/mobile/exchange', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

function googleGrant(access = 'google-access') {
  return { access_token: access, refresh_token: 'google-refresh', token_type: 'Bearer', expires_in: 3600, scope };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('AI_API_KEY', 'test-ai-key');
  vi.stubEnv('AI_MODEL', 'test-model');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'web-client');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'server-key');
  vi.stubEnv('SESSION_SECRET', key);
  cookieMocks.get.mockReturnValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('Request-aware auth resolver', () => {
  it('preserves web cookies and prefers valid mobile Bearer without touching cookies', async () => {
    const { kind: _kind, expiresAt: _expiry, ...web } = sampleSession();
    cookieMocks.get.mockReturnValue({ value: await encryptSession(web, key) });
    expect(await getServerSession()).toEqual(web);
    cookieMocks.get.mockClear();
    const mobile = sampleSession();
    expect(await getServerSession(await bearerRequest('/api/auth/google/status', mobile, 'GET'))).toEqual(mobile);
    expect(cookieMocks.get).not.toHaveBeenCalled();
  });

  it.each(['Bearer invalid', '', 'Basic YWJj', 'Bearer one two'])('fails closed for explicit invalid Authorization %s', async (value) => {
    cookieMocks.get.mockReturnValue({ value: await encryptSession({ ...sampleSession(), kind: undefined }, key) });
    const request = new Request('https://app.example.com/api', { headers: { Authorization: value } });
    await expect(getServerSession(request)).rejects.toBeInstanceOf(AuthError);
    expect(cookieMocks.get).not.toHaveBeenCalled();
  });

  it('does not accept a web JWE as a Bearer credential', async () => {
    const web = await encryptSession({ ...sampleSession(), kind: undefined }, key);
    await expect(getServerSession(new Request('https://app.example.com/api', { headers: { Authorization: `Bearer ${web}` } }))).rejects.toBeInstanceOf(AuthError);
  });

  it('does not auto-refresh mobile access or write cookies and signals expired access', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const mobile = sampleSession();
    mobile.tokens.expiresAt = Date.now() + 1000;
    expect(await getValidAccessToken(mobile)).toEqual({ accessToken: mobile.tokens.accessToken });
    mobile.tokens.expiresAt = Date.now() - 1000;
    await expect(getValidAccessToken(mobile)).rejects.toMatchObject({ code: 'SESSION_REFRESH_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookieMocks.set).not.toHaveBeenCalled();
  });

  it('still refreshes a web access grant and updates only the web cookie', async () => {
    const mobile = sampleSession();
    const web: SessionData = { user: mobile.user, tokens: { ...mobile.tokens, expiresAt: Date.now() - 1000 }, createdAt: mobile.createdAt };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(googleGrant('renewed-web-access'))));
    expect(await getValidAccessToken(web)).toMatchObject({ accessToken: 'renewed-web-access' });
    expect(cookieMocks.set).toHaveBeenCalledOnce();
  });

  it('maps only known auth failures to sanitized no-store responses', async () => {
    const response = authErrorResponse(new AuthError());
    expect(response?.status).toBe(401);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(authErrorResponse(new Error('private-internal-message'))).toBeNull();
  });
});

describe('Native exchange endpoint', () => {
  it('returns only JWE, profile and expiries without Google grants or cookies', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json(googleGrant()))
      .mockResolvedValueOnce(Response.json({ id: 'google-user', email: 'user@example.com', name: 'Người dùng', verified_email: true })));
    const response = await exchange(exchangeRequest({ code: 'native-sdk-code' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const payload = await response.json();
    expect(Object.keys(payload).sort()).toEqual(['accessTokenExpiresAt', 'expiresAt', 'session', 'user']);
    expect(payload.expiresAt - payload.accessTokenExpiresAt).toBeGreaterThan(28 * 86400000);
    expect((await decryptMobileSession(payload.session, key))?.user.id).toBe('google-user');
    expect(JSON.stringify(payload)).not.toContain('google-refresh');
    expect(JSON.stringify(payload)).not.toContain('google-access');
    expect(cookieMocks.set).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it.each([{ code: '' }, { code: 'x', user: { id: 'attacker' } }, { code: 'x'.repeat(4097) }])('rejects untrusted exchange payloads', async (body) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await exchange(exchangeRequest(body))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('limits actual streamed body size and requires JSON', async () => {
    expect((await exchange(exchangeRequest({ code: 'x'.repeat(9000) }))).status).toBe(413);
    expect((await exchange(new Request('https://app.example.com/api', { method: 'POST', body: 'code=x' }))).status).toBe(415);
  });

  it('returns safe errors for replayed codes and never Google error detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'invalid_grant', error_description: 'private-code-value' }, { status: 400 })));
    const response = await exchange(exchangeRequest({ code: 'replayed-code' }));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('private-code-value');
    expect(cookieMocks.set).not.toHaveBeenCalled();
  });
});

describe('Native refresh and profile endpoints', () => {
  it('reissues mobile JWE without extending absolute expiry or writing cookies', async () => {
    const original = sampleSession();
    original.tokens.expiresAt = Date.now() - 1000;
    const request = await bearerRequest('/api/auth/mobile/refresh', original);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(googleGrant('new-google-access'))));
    const response = await refresh(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    const updated = await decryptMobileSession(payload.session, key);
    expect(updated?.createdAt).toBe(original.createdAt);
    expect(updated?.expiresAt).toBe(original.expiresAt);
    expect(payload.expiresAt).toBe(original.expiresAt);
    expect(updated?.tokens.accessToken).toBe('new-google-access');
    expect(payload.accessTokenExpiresAt).toBeGreaterThan(original.tokens.expiresAt);
    expect(cookieMocks.set).not.toHaveBeenCalled();
    expect(cookieMocks.get).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects missing Bearer or revoked Google grant, without web cookie fallback', async () => {
    expect((await refresh(new Request('https://app.example.com/api', { method: 'POST' }))).status).toBe(401);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'invalid_grant' }, { status: 400 })));
    expect((await refresh(await bearerRequest('/api/auth/mobile/refresh'))).status).toBe(401);
    expect(cookieMocks.get).not.toHaveBeenCalled();
    expect(cookieMocks.set).not.toHaveBeenCalled();
  });

  it('returns sanitized mobile status and rejects invalid Bearer rather than anonymous status', async () => {
    const response = await status(await bearerRequest('/api/auth/google/status', sampleSession(), 'GET'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const payload = await response.json();
    expect(payload.authenticated).toBe(true);
    expect(payload.user.id).toBe('google-user');
    expect(payload.tokens).toBeUndefined();
    expect((await status(new Request('https://app.example.com/api', { headers: { Authorization: 'Bearer invalid' } }))).status).toBe(401);
  });

  it('mobile logout never clears a separate web cookie', async () => {
    expect((await logout(await bearerRequest('/api/auth/google/logout'))).status).toBe(200);
    expect(cookieMocks.delete).not.toHaveBeenCalled();
    expect((await logout(new Request('https://app.example.com/api/auth/google/logout', { method: 'POST' }))).status).toBe(200);
    expect(cookieMocks.delete).toHaveBeenCalledOnce();
  });

  it('production env refuses default session key even if other configuration exists', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(EnvSchema.safeParse({ AI_API_KEY: 'key', AI_MODEL: 'model' }).success).toBe(false);
    expect(EnvSchema.safeParse({ AI_API_KEY: 'key', AI_MODEL: 'model', SESSION_SECRET: key }).success).toBe(true);
  });
});
