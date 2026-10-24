import { cookies } from 'next/headers';
import { getServerEnv } from '../env';
import { GoogleOAuthError, refreshGoogleAccessToken } from './google-oauth';
import { SESSION_COOKIE_NAME, decryptMobileSession, decryptSession, encryptSession } from './session';
import type { SessionData } from './types';

export class AuthError extends Error {
  constructor(
    message = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
    public readonly code = 'UNAUTHORIZED'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function authErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AuthError) && !(error instanceof GoogleOAuthError)) return null;
  const status = error instanceof GoogleOAuthError ? error.status : 401;
  return Response.json({ error: error.message, code: error.code }, {
    status,
    headers: { 'Cache-Control': 'no-store', ...(status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}) },
  });
}

export async function getServerSession(request?: Request): Promise<SessionData | null> {
  const authorization = request?.headers.get('authorization');
  if (authorization !== null && authorization !== undefined) {
    // An explicit Authorization header is never allowed to fall back to web cookies.
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(authorization);
    if (!match || match[1].length > 32768) throw new AuthError();
    const env = getServerEnv();
    const session = await decryptMobileSession(match[1], env.SESSION_SECRET);
    if (!session) throw new AuthError();
    return session;
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!value) return null;
  const env = getServerEnv();
  return decryptSession(value, env.SESSION_SECRET);
}

export async function setServerSession(session: SessionData): Promise<void> {
  const env = getServerEnv();
  const encrypted = await encryptSession(session, env.SESSION_SECRET);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function clearServerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getValidAccessToken(
  session: SessionData,
  request?: Request
): Promise<{ accessToken: string; updatedSession?: SessionData }> {
  const now = Date.now();
  if (session.kind === 'mobile' || request?.headers.has('authorization')) {
    if (session.kind !== 'mobile' || !session.expiresAt || session.expiresAt <= now) throw new AuthError();
    if (session.tokens.expiresAt <= now) {
      // The mobile refresh endpoint returns the replacement JWE to SecureStore.
      // Refreshing here would silently discard it and repeatedly use stale grants.
      throw new AuthError('Vui lòng làm mới phiên đăng nhập trước khi tiếp tục.', 'SESSION_REFRESH_REQUIRED');
    }
    return { accessToken: session.tokens.accessToken };
  }

  if (session.tokens.expiresAt - now > 5 * 60 * 1000) {
    return { accessToken: session.tokens.accessToken };
  }
  if (!session.tokens.refreshToken) {
    if (session.tokens.expiresAt > now) return { accessToken: session.tokens.accessToken };
    throw new AuthError('Quyền truy cập Google đã hết hạn. Vui lòng kết nối lại tài khoản Google.');
  }

  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Chưa cấu hình Google trên server.');
  }
  const refreshedTokens = await refreshGoogleAccessToken(
    session.tokens.refreshToken,
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    session.tokens.scope
  );
  const updatedSession: SessionData = { ...session, tokens: refreshedTokens };
  await setServerSession(updatedSession);
  return { accessToken: refreshedTokens.accessToken, updatedSession };
}
