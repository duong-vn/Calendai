import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GOOGLE_OAUTH_SCOPES,
  exchangeCodeForTokens,
  exchangeNativeCodeForTokens,
  generateOAuthState,
  getGoogleAuthUrl,
  refreshGoogleAccessToken,
} from '../google-oauth';

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
});
