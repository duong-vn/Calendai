import { z } from 'zod';
import { UserProfileSchema, type GoogleTokens, type UserProfile } from './types';

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.events',
];

export class GoogleOAuthError extends Error {
  constructor(message: string, public readonly status: 401 | 502 = 502, public readonly code = 'google_unavailable') {
    super(message);
    this.name = 'GoogleOAuthError';
  }
}

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

const GoogleTokenResponseSchema = z.object({
  access_token: z.string().min(1).max(16384),
  refresh_token: z.string().min(1).max(16384).optional(),
  expires_in: z.number().int().positive().max(86400),
  token_type: z.literal('Bearer'),
  scope: z.string().max(8192).optional(),
});

async function googleFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) });
  } catch {
    throw new GoogleOAuthError('Không thể kết nối Google. Vui lòng thử lại sau.');
  }
}

async function requestGoogleTokens(body: URLSearchParams, previous?: { refreshToken: string; scope?: string }): Promise<GoogleTokens> {
  const response = await googleFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    // Never forward Google's error payload: it may contain supplied codes or other sensitive data.
    if (response.status === 400 || response.status === 401) {
      throw new GoogleOAuthError('Mã đăng nhập hoặc quyền truy cập Google đã hết hiệu lực. Vui lòng đăng nhập lại.', 401, 'google_reauthorization_required');
    }
    throw new GoogleOAuthError('Google chưa thể xác thực tài khoản. Vui lòng thử lại sau.');
  }
  const parsed = GoogleTokenResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new GoogleOAuthError('Phản hồi xác thực Google không hợp lệ. Vui lòng thử lại.');
  }
  const data = parsed.data;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? previous?.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type,
    scope: data.scope ?? previous?.scope ?? '',
  };
}

async function fetchGoogleProfile(accessToken: string, requireVerifiedEmail: boolean): Promise<UserProfile> {
  const response = await googleFetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new GoogleOAuthError('Không thể xác minh thông tin tài khoản Google. Vui lòng đăng nhập lại.', response.status === 401 ? 401 : 502);
  }
  const parsed = UserProfileSchema.extend({ verified_email: z.boolean().optional() })
    .safeParse(await response.json().catch(() => null));
  if (!parsed.success || (requireVerifiedEmail && parsed.data.verified_email !== true)) {
    throw new GoogleOAuthError('Thông tin tài khoản Google chưa được xác minh hoặc không hợp lệ.', 401, 'google_profile_invalid');
  }
  return UserProfileSchema.parse(parsed.data);
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<{ tokens: GoogleTokens; user: UserProfile }> {
  const tokens = await requestGoogleTokens(new URLSearchParams({
    code, client_id: clientId, client_secret: clientSecret,
    redirect_uri: redirectUri, grant_type: 'authorization_code',
  }));
  return { tokens, user: await fetchGoogleProfile(tokens.accessToken, false) };
}

export async function exchangeNativeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<{ tokens: GoogleTokens; user: UserProfile }> {
  // Native SDK serverAuthCode is not the web redirect flow. Google's native server
  // access documentation permits an empty redirect URI: developers.google.com/identity/sign-in/ios/offline-access.
  const tokens = await requestGoogleTokens(new URLSearchParams({
    code, client_id: clientId, client_secret: clientSecret,
    redirect_uri: '', grant_type: 'authorization_code',
  }));
  if (!tokens.refreshToken) {
    throw new GoogleOAuthError('Google chưa cấp quyền truy cập ngoại tuyến. Vui lòng cấp lại quyền Google rồi đăng nhập lại.', 401, 'google_consent_required');
  }
  if (!tokens.scope.split(/\s+/).includes('https://www.googleapis.com/auth/calendar.events')) {
    throw new GoogleOAuthError('Vui lòng cấp quyền quản lý sự kiện Google Calendar rồi đăng nhập lại.', 401, 'google_calendar_permission_required');
  }
  return { tokens, user: await fetchGoogleProfile(tokens.accessToken, true) };
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  previousScope?: string
): Promise<GoogleTokens> {
  return requestGoogleTokens(new URLSearchParams({
    client_id: clientId, client_secret: clientSecret,
    refresh_token: refreshToken, grant_type: 'refresh_token',
  }), { refreshToken, scope: previousScope });
}
