import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as googleAuthStart } from '@/app/api/auth/google/route';
import { GET as googleAuthCallback } from '@/app/api/auth/google/callback/route';
import { OAUTH_STATE_COOKIE_NAME } from '../session';
import {
  GOOGLE_OAUTH_SCOPES,
  exchangeCodeForTokens,
  exchangeNativeCodeForTokens,
  generateOAuthState,
  getGoogleAuthUrl,
  refreshGoogleAccessToken,
} from '../google-oauth';

const cookieMocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieMocks) }));

describe('Google OAuth Layer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generates unique random states', () => {
    const state1 = generateOAuthState();
    const state2 = generateOAuthState();
    expect(state1).toBeDefined();
    expect(state2).toBeDefined();
    expect(state1).not.toBe(state2);
  });

  it('builds valid Google authorization URL with necessary parameters', () => {
    const state = 'test-state-123';
    const redirectUri = 'http://localhost:3000/api/auth/google/callback';
    const clientId = 'test-client-id.apps.googleusercontent.com';

    const urlString = getGoogleAuthUrl(state, redirectUri, clientId);
    const url = new URL(urlString);

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe(clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe(state);

    const scopes = url.searchParams.get('scope')?.split(' ');
    expect(scopes).toEqual(expect.arrayContaining(GOOGLE_OAUTH_SCOPES));
    expect(scopes).toContain('https://www.googleapis.com/auth/calendar.events');
  });

  it('exchanges code for tokens and fetches user info successfully', async () => {
    const mockTokenResponse = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/calendar.events',
    };

    const mockUserInfoResponse = {
      id: 'mock-user-123',
      email: 'user@example.com',
      name: 'Nguyen Van Test',
      picture: 'https://example.com/avatar.png',
    };

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('oauth2.googleapis.com/token')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockTokenResponse,
        });
      }
      if (url.includes('googleapis.com/oauth2/v2/userinfo')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockUserInfoResponse,
        });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });

    vi.stubGlobal('fetch', mockFetch);

    const result = await exchangeCodeForTokens(
      'mock-code',
      'http://localhost:3000/callback',
      'client-id',
      'client-secret'
    );

    expect(result.tokens.accessToken).toBe('mock-access-token');
    expect(result.tokens.refreshToken).toBe('mock-refresh-token');
    expect(result.user.email).toBe('user@example.com');
    expect(result.user.name).toBe('Nguyen Van Test');
  });

  it.each([
    'openid email profile',
    undefined,
    '',
    'https://www.googleapis.com/auth/calendar.events.readonly',
  ])('rejects web consent without Calendar events permission (scope: %s)', async (scope) => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({
        access_token: 'access-value', refresh_token: 'refresh-value', expires_in: 3600,
        token_type: 'Bearer', scope,
      }))
      .mockResolvedValueOnce(Response.json({ id: 'google-id', email: 'user@example.com', name: 'Test' }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(exchangeCodeForTokens('code', 'http://localhost:3000/callback', 'client', 'key'))
      .rejects.toMatchObject({
        status: 401,
        code: 'google_calendar_permission_required',
        message: 'Vui lòng cấp quyền quản lý sự kiện Google Calendar rồi đăng nhập lại.',
      });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  const nativeGrant = {
    access_token: 'access-value', refresh_token: 'refresh-value', expires_in: 3600,
    token_type: 'Bearer', scope: 'https://www.googleapis.com/auth/calendar.events',
  };
  const nativeProfile = { id: 'google-id', email: 'user@example.com', name: 'Tên người dùng', verified_email: true };

  it('exchanges a native SDK code with empty redirect_uri and reads verified profile server-side', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(Response.json(nativeGrant))
      .mockResolvedValueOnce(Response.json(nativeProfile));
    vi.stubGlobal('fetch', mockFetch);
    const result = await exchangeNativeCodeForTokens('native-code', 'web-client', 'server-only');
    const form = new URLSearchParams(mockFetch.mock.calls[0][1].body);
    expect(form.get('redirect_uri')).toBe('');
    expect(form.get('client_id')).toBe('web-client');
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(result.user).toEqual({ id: nativeProfile.id, email: nativeProfile.email, name: nativeProfile.name });
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe('Bearer access-value');
  });

  it('rejects replayed/invalid Google codes without leaking Google payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error_description: 'sensitive-code-payload' }, { status: 400 })));
    await expect(exchangeNativeCodeForTokens('native-code', 'web-client', 'server-only')).rejects.toMatchObject({ status: 401 });
    await expect(exchangeNativeCodeForTokens('native-code', 'web-client', 'server-only')).rejects.not.toThrow('sensitive-code-payload');
  });

  it('requires refresh grants and Calendar scope before issuing mobile sessions', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ ...nativeGrant, refresh_token: undefined }))
      .mockResolvedValueOnce(Response.json({ ...nativeGrant, scope: 'openid email' }));
    vi.stubGlobal('fetch', mockFetch);
    await expect(exchangeNativeCodeForTokens('code', 'client', 'key')).rejects.toMatchObject({ code: 'google_consent_required' });
    await expect(exchangeNativeCodeForTokens('code', 'client', 'key')).rejects.toMatchObject({ code: 'google_calendar_permission_required' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('rejects unverified or malformed Google profiles and malformed grants', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(Response.json(nativeGrant))
      .mockResolvedValueOnce(Response.json({ ...nativeProfile, verified_email: false }))
      .mockResolvedValueOnce(Response.json({ ...nativeGrant, expires_in: '3600' }));
    vi.stubGlobal('fetch', mockFetch);
    await expect(exchangeNativeCodeForTokens('code', 'client', 'key')).rejects.toMatchObject({ code: 'google_profile_invalid' });
    await expect(exchangeNativeCodeForTokens('code', 'client', 'key')).rejects.toMatchObject({ status: 502 });
  });

  it('reports revoked refresh grants safely and preserves prior scopes when omitted', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ ...nativeGrant, scope: undefined, refresh_token: undefined }))
      .mockResolvedValueOnce(Response.json({ error_description: 'private-value' }, { status: 400 }));
    vi.stubGlobal('fetch', mockFetch);
    expect(await refreshGoogleAccessToken('old-refresh', 'client', 'key', nativeGrant.scope)).toMatchObject({ refreshToken: 'old-refresh', scope: nativeGrant.scope });
    await expect(refreshGoogleAccessToken('old-refresh', 'client', 'key')).rejects.toMatchObject({ status: 401 });
  });

  it('refreshes access token successfully', async () => {
    const mockRefreshResponse = {
      access_token: 'new-access-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/calendar.events',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRefreshResponse,
    });

    vi.stubGlobal('fetch', mockFetch);

    const refreshed = await refreshGoogleAccessToken(
      'current-refresh-token',
      'client-id',
      'client-secret'
    );

    expect(refreshed.accessToken).toBe('new-access-token');
    expect(refreshed.refreshToken).toBe('current-refresh-token'); // preserved
  });

  it.each([
    { scope: 'openid email profile', previousScope: 'openid email profile https://www.googleapis.com/auth/calendar.events' },
    { scope: 'https://www.googleapis.com/auth/calendar.readonly', previousScope: 'https://www.googleapis.com/auth/calendar.events' },
    { scope: '', previousScope: 'https://www.googleapis.com/auth/calendar.events' },
    { scope: undefined, previousScope: 'openid email profile' },
    { scope: undefined, previousScope: undefined },
  ])('rejects refreshed tokens missing Calendar events scope ($scope / prev: $previousScope)', async ({ scope, previousScope }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({
      access_token: 'narrowed-access-token',
      expires_in: 3600,
      token_type: 'Bearer',
      ...(scope !== undefined ? { scope } : {}),
    })));

    await expect(
      refreshGoogleAccessToken('current-refresh-token', 'client-id', 'client-secret', previousScope)
    ).rejects.toMatchObject({
      status: 401,
      code: 'google_calendar_permission_required',
      message: 'Vui lòng cấp quyền quản lý sự kiện Google Calendar rồi đăng nhập lại.',
    });
  });
});

describe('Web OAuth routes auth_error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieMocks.get.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('redirects with google_not_configured when Google OAuth credentials are missing', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');

    const res = await googleAuthStart(new Request('https://calendai.tduong.online/api/auth/google'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    const redirectUrl = new URL(location);
    expect(redirectUrl.pathname).toBe('/');
    expect(redirectUrl.searchParams.get('auth_error')).toBe('google_not_configured');
  });

  it('masks internal env/server errors in GET /api/auth/google and never double-encodes auth_error', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'web-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'web-client-secret');
    vi.stubEnv('AI_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('AI_MODEL', 'gpt-4o-mini');

    const res = await googleAuthStart(new Request('https://calendai.tduong.online/api/auth/google'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    const redirectUrl = new URL(location);
    const authError = redirectUrl.searchParams.get('auth_error')!;

    expect(location).not.toContain('%25');
    expect(location).not.toContain('AI_API_KEY');
    expect(location).not.toContain('SESSION_SECRET');
    expect(authError).not.toContain('AI_API_KEY');
    expect(authError).not.toMatch(/%[0-9A-Fa-f]{2}/);
    expect(authError).toBe('Không thể khởi tạo đăng nhập Google lúc này. Vui lòng thử lại sau.');
  });

  it('sanitizes ?error= on GET /api/auth/google/callback without echoing raw input or %', async () => {
    const deniedRes = await googleAuthCallback(
      new Request('https://calendai.tduong.online/api/auth/google/callback?error=access_denied')
    );
    expect(deniedRes.status).toBe(307);
    const deniedUrl = new URL(deniedRes.headers.get('location')!);
    expect(deniedRes.headers.get('location')).not.toContain('%25');
    expect(deniedUrl.searchParams.get('auth_error')).toBe(
      'Bạn đã từ chối cấp quyền kết nối Google Calendar.'
    );

    for (const untrusted of ['100%25', 'Visit%20https%3A%2F%2Fevil.example']) {
      const res = await googleAuthCallback(
        new Request(`https://calendai.tduong.online/api/auth/google/callback?error=${untrusted}`)
      );
      expect(res.status).toBe(307);
      const rawLocation = res.headers.get('location')!;
      const redirectUrl = new URL(rawLocation);
      const authError = redirectUrl.searchParams.get('auth_error')!;

      expect(rawLocation).not.toContain('100%');
      expect(rawLocation).not.toContain('evil.example');
      expect(authError).not.toContain('100%');
      expect(authError).not.toContain('evil.example');
      expect(authError).toBe('Google từ chối ủy quyền đăng nhập. Vui lòng thử lại.');
    }
  });

  it('single-encodes controlled GoogleOAuthError messages and masks internal errors on callback', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'web-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'web-client-secret');
    vi.stubEnv('AI_API_KEY', 'test-ai-key');
    vi.stubEnv('AI_MODEL', 'gpt-4o-mini');
    vi.stubEnv('SESSION_SECRET', 'test-key-1234567890-abcdefghijklmnopqrstuvwxyz');

    cookieMocks.get.mockImplementation((name: string) =>
      name === OAUTH_STATE_COOKIE_NAME ? { value: 'valid-state' } : undefined
    );

    // 1. Controlled GoogleOAuthError (missing calendar.events scope) is single-encoded
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        Response.json({
          access_token: 'access-value',
          refresh_token: 'refresh-value',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'openid email profile',
        })
      )
    );

    const oauthErrRes = await googleAuthCallback(
      new Request('https://calendai.tduong.online/api/auth/google/callback?code=auth-code&state=valid-state')
    );
    expect(oauthErrRes.status).toBe(307);
    const oauthErrLocation = oauthErrRes.headers.get('location')!;
    const oauthErrUrl = new URL(oauthErrLocation);
    expect(oauthErrLocation).not.toContain('%25');
    expect(oauthErrUrl.searchParams.get('auth_error')).toBe(
      'Vui lòng cấp quyền quản lý sự kiện Google Calendar rồi đăng nhập lại.'
    );

    // 2. Internal server/config error (missing AI_API_KEY) is masked and single-encoded
    vi.stubEnv('AI_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');

    const internalErrRes = await googleAuthCallback(
      new Request('https://calendai.tduong.online/api/auth/google/callback?code=auth-code&state=valid-state')
    );
    expect(internalErrRes.status).toBe(307);
    const internalErrLocation = internalErrRes.headers.get('location')!;
    const internalErrUrl = new URL(internalErrLocation);
    const internalAuthError = internalErrUrl.searchParams.get('auth_error')!;

    expect(internalErrLocation).not.toContain('%25');
    expect(internalErrLocation).not.toContain('AI_API_KEY');
    expect(internalErrLocation).not.toContain('SESSION_SECRET');
    expect(internalAuthError).not.toContain('AI_API_KEY');
    expect(internalAuthError).toBe('Xác thực Google thất bại. Vui lòng thử lại sau.');

    // 3. Missing code/state and CSRF mismatch redirect with single-encoded Vietnamese messages
    const missingParamsRes = await googleAuthCallback(
      new Request('https://calendai.tduong.online/api/auth/google/callback?code=only-code')
    );
    expect(missingParamsRes.headers.get('location')).not.toContain('%25');
    expect(new URL(missingParamsRes.headers.get('location')!).searchParams.get('auth_error')).toBe(
      'Thiếu mã xác thực hoặc trạng thái bảo mật từ phản hồi của Google. Vui lòng thử lại.'
    );

    cookieMocks.delete.mockClear();
    const csrfMismatchRes = await googleAuthCallback(
      new Request('https://calendai.tduong.online/api/auth/google/callback?code=auth-code&state=forged-state')
    );
    expect(csrfMismatchRes.headers.get('location')).not.toContain('%25');
    expect(new URL(csrfMismatchRes.headers.get('location')!).searchParams.get('auth_error')).toBe(
      'Lỗi bảo mật CSRF: State không khớp hoặc đã hết hạn. Vui lòng thử lại.'
    );
    expect(cookieMocks.delete).not.toHaveBeenCalled();
  });
});
