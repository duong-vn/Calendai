import { EncryptJWT, jwtDecrypt } from 'jose';
import type { SessionData } from './types';

export const SESSION_COOKIE_NAME = 'calendai_session';
export const OAUTH_STATE_COOKIE_NAME = 'calendai_oauth_state';
const SESSION_EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

async function getEncryptionKey(secret: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return new Uint8Array(hash);
}

export async function encryptSession(session: SessionData, secret: string): Promise<string> {
  const key = await getEncryptionKey(secret);
  return new EncryptJWT({ session })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRATION_SECONDS}s`)
    .encrypt(key);
}

export async function decryptSession(token: string, secret: string): Promise<SessionData | null> {
  try {
    const key = await getEncryptionKey(secret);
    const { payload } = await jwtDecrypt(token, key, {
      contentEncryptionAlgorithms: ['A256GCM'],
      keyManagementAlgorithms: ['dir'],
    });

    if (!payload.session || typeof payload.session !== 'object') {
      return null;
    }

    return payload.session as SessionData;
  } catch {
    return null;
  }
}
