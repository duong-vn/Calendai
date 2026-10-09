import { cookies } from 'next/headers';
import { getServerEnv } from '../env';
import { refreshGoogleAccessToken } from './google-oauth';
import {
  SESSION_COOKIE_NAME,
  decryptSession,
  encryptSession,
} from './session';
import type { SessionData } from './types';

export async function getServerSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const env = getServerEnv();
  return decryptSession(token, env.SESSION_SECRET);
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

export async function clearServerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Kiểm tra và tự động refresh token nếu còn dưới 5 phút
 */
export async function getValidAccessToken(
  session: SessionData
): Promise<{ accessToken: string; updatedSession?: SessionData }> {
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer

  if (session.tokens.expiresAt - now > bufferMs) {
    return { accessToken: session.tokens.accessToken };
  }

  // Token sắp hết hạn -> refresh
  if (!session.tokens.refreshToken) {
    // Không có refresh token, trả về token hiện tại nếu chưa hết hạn
    if (session.tokens.expiresAt > now) {
      return { accessToken: session.tokens.accessToken };
    }
    throw new Error('Access Token đã hết hạn và không có Refresh Token để làm mới. Vui lòng kết nối lại tài khoản Google.');
  }

  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Chưa cấu hình GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trên server.');
  }

  const refreshedTokens = await refreshGoogleAccessToken(
    session.tokens.refreshToken,
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET
  );

  const updatedSession: SessionData = {
    ...session,
    tokens: refreshedTokens,
  };

  // Cập nhật lại session cookie
  await setServerSession(updatedSession);

  return {
    accessToken: refreshedTokens.accessToken,
    updatedSession,
  };
}
