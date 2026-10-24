import { EncryptJWT, jwtDecrypt } from 'jose';
import { SessionKeySchema } from '../env';
import { MobileSessionDataSchema, SessionDataSchema, type MobileSessionData, type SessionData } from './types';

export const SESSION_COOKIE_NAME = 'calendai_session';
export const OAUTH_STATE_COOKIE_NAME = 'calendai_oauth_state';
export const SESSION_EXPIRATION_SECONDS = 30 * 24 * 60 * 60;
export const MOBILE_SESSION_AUDIENCE = 'calendai:mobile';
const WEB_SESSION_AUDIENCE = 'calendai:web';
const MOBILE_SESSION_PURPOSE = 'mobile-session';

async function getEncryptionKey(secret: string): Promise<Uint8Array> {
  SessionKeySchema.parse(secret);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return new Uint8Array(hash);
}

export async function encryptSession(session: SessionData, secret: string): Promise<string> {
  const parsed = SessionDataSchema.parse(session);
  if (parsed.kind === 'mobile') {
    throw new Error('Không thể lưu phiên mobile vào cookie web.');
  }
  const key = await getEncryptionKey(secret);
  return new EncryptJWT({ session: parsed, purpose: 'web-session' })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setAudience(WEB_SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRATION_SECONDS}s`)
    .encrypt(key);
}

export async function decryptSession(token: string, secret: string): Promise<SessionData | null> {
  const key = await getEncryptionKey(secret);
  try {
    const { payload } = await jwtDecrypt(token, key, {
      contentEncryptionAlgorithms: ['A256GCM'],
      keyManagementAlgorithms: ['dir'],
    });
    // Existing web cookies did not have audience/purpose claims.
    if ((payload.aud !== undefined && payload.aud !== WEB_SESSION_AUDIENCE) ||
        (payload.purpose !== undefined && payload.purpose !== 'web-session')) {
      return null;
    }
    const parsed = SessionDataSchema.safeParse(payload.session);
    return parsed.success && parsed.data.kind !== 'mobile' ? parsed.data : null;
  } catch {
    return null;
  }
}

function validMobileHorizon(session: MobileSessionData): boolean {
  return session.createdAt <= Date.now() &&
    session.expiresAt > Date.now() &&
    session.expiresAt > session.createdAt &&
    session.expiresAt <= session.createdAt + SESSION_EXPIRATION_SECONDS * 1000;
}

export async function encryptMobileSession(session: MobileSessionData, secret: string): Promise<string> {
  const parsed = MobileSessionDataSchema.parse(session);
  if (!validMobileHorizon(parsed)) {
    throw new Error('Thời hạn phiên mobile không hợp lệ. Vui lòng đăng nhập lại.');
  }
  const key = await getEncryptionKey(secret);
  return new EncryptJWT({ session: parsed, purpose: MOBILE_SESSION_PURPOSE })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM', typ: 'JWT' })
    .setAudience(MOBILE_SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(parsed.expiresAt / 1000))
    .encrypt(key);
}

export async function decryptMobileSession(value: string, secret: string): Promise<MobileSessionData | null> {
  const key = await getEncryptionKey(secret);
  try {
    const { payload } = await jwtDecrypt(value, key, {
      audience: MOBILE_SESSION_AUDIENCE,
      contentEncryptionAlgorithms: ['A256GCM'],
      keyManagementAlgorithms: ['dir'],
      requiredClaims: ['exp', 'iat', 'aud'],
    });
    if (payload.purpose !== MOBILE_SESSION_PURPOSE) return null;
    const parsed = MobileSessionDataSchema.safeParse(payload.session);
    if (!parsed.success || !validMobileHorizon(parsed.data) ||
        payload.exp !== Math.floor(parsed.data.expiresAt / 1000)) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
