import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GOOGLE_OAUTH_SCOPES,
  exchangeCodeForTokens,
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
