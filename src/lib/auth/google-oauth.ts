import type { GoogleTokens, UserProfile } from './types';

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.events',
];

export function generateOAuthState(): string {
  return crypto.randomUUID();
}

export function getGoogleAuthUrl(state: string, redirectUri: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfoResponse {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<{ tokens: GoogleTokens; user: UserProfile }> {
  const tokenUrl = 'https://oauth2.googleapis.com/token';

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
    throw new Error(
      `Đổi mã authorization code thất bại: ${errorData.error_description || errorData.error || response.statusText}`
    );
  }

  const tokenData = (await response.json()) as GoogleTokenResponse;
  const expiresAt = Date.now() + tokenData.expires_in * 1000;

  // Lấy thông tin user
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error('Không thể lấy thông tin tài khoản Google của người dùng.');
  }

  const userData = (await userResponse.json()) as GoogleUserInfoResponse;

  return {
    tokens: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
    },
    user: {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
    },
  };
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleTokens> {
  const tokenUrl = 'https://oauth2.googleapis.com/token';

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
    throw new Error(
      `Làm mới Access Token thất bại: ${errorData.error_description || errorData.error || response.statusText}`
    );
  }

  const tokenData = (await response.json()) as GoogleTokenResponse;
  const expiresAt = Date.now() + tokenData.expires_in * 1000;

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || refreshToken, // giữ lại refresh token cũ nếu không cấp mới
    expiresAt,
    tokenType: tokenData.token_type,
    scope: tokenData.scope,
  };
}
