import { EncryptJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decryptMobileSession, decryptSession, encryptMobileSession, encryptSession, MOBILE_SESSION_AUDIENCE, SESSION_EXPIRATION_SECONDS } from '../session';
import type { MobileSessionData } from '../types';
import type { SessionData } from '../types';

describe('Auth Session Layer (JWE with jose)', () => {
  const secretKey = 'my_super_secret_test_key_with_at_least_32_characters';
  const sampleSession: SessionData = {
    user: {
      id: 'google-sub-12345',
      email: 'test@example.com',
      name: 'Nguyen Van A',
      picture: 'https://example.com/avatar.jpg',
    },
    tokens: {
      accessToken: 'sample_access_token_abc',
      refreshToken: 'sample_refresh_token_xyz',
      expiresAt: Date.now() + 3600 * 1000,
      tokenType: 'Bearer',
      scope: 'https://www.googleapis.com/auth/calendar.events',
    },
    createdAt: Date.now(),
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  async function customJwe(session: unknown, audience?: string, purpose?: string) {
    const key = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secretKey)));
    let jwt = new EncryptJWT({ session, ...(purpose ? { purpose } : {}) })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime(Math.floor((Date.now() + SESSION_EXPIRATION_SECONDS * 1000) / 1000));
    if (audience) jwt = jwt.setAudience(audience);
    return jwt.encrypt(key);
  }

  function mobileSession(): MobileSessionData {
    const now = Date.now();
    return {
      ...sampleSession,
      createdAt: now,
      kind: 'mobile',
      expiresAt: now + (SESSION_EXPIRATION_SECONDS - 60) * 1000,
      tokens: { ...sampleSession.tokens, refreshToken: 'refresh-value' },
    };
  }

  it('keeps legacy web cookies compatible and rejects malformed runtime payloads', async () => {
    expect(await decryptSession(await customJwe(sampleSession), secretKey)).toEqual(sampleSession);
    expect(await decryptSession(await customJwe({ user: { id: 'forged' } }), secretKey)).toBeNull();
  });

  it('separates mobile purpose/audience from web sessions', async () => {
    const session = mobileSession();
    const value = await encryptMobileSession(session, secretKey);
    expect(await decryptMobileSession(value, secretKey)).toEqual(session);
    expect(await decryptSession(value, secretKey)).toBeNull();
    expect(await decryptMobileSession(await encryptSession(sampleSession, secretKey), secretKey)).toBeNull();
    expect(await decryptMobileSession(await customJwe(session, 'other-app', 'mobile-session'), secretKey)).toBeNull();
    expect(await decryptMobileSession(await customJwe(session, MOBILE_SESSION_AUDIENCE, 'web-session'), secretKey)).toBeNull();
    await expect(encryptSession(session, secretKey)).rejects.toThrow();
  });

  it('rejects mobile malformed payloads, missing refresh grants and extended horizons', async () => {
    const session = mobileSession();
    expect(await decryptMobileSession(await customJwe({ ...session, user: {} }, MOBILE_SESSION_AUDIENCE, 'mobile-session'), secretKey)).toBeNull();
    expect(await decryptMobileSession(await customJwe({ ...session, tokens: { ...session.tokens, refreshToken: undefined } }, MOBILE_SESSION_AUDIENCE, 'mobile-session'), secretKey)).toBeNull();
    await expect(encryptMobileSession({ ...session, expiresAt: session.createdAt + SESSION_EXPIRATION_SECONDS * 1000 + 1000 }, secretKey)).rejects.toThrow();
  });

  it('expires mobile sessions at the absolute 30-day horizon', async () => {
    vi.useFakeTimers();
    const session = mobileSession();
    const value = await encryptMobileSession(session, secretKey);
    vi.setSystemTime(session.expiresAt + 1);
    expect(await decryptMobileSession(value, secretKey)).toBeNull();
  });

  it('refuses default, missing and obviously weak production session keys', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(encryptSession(sampleSession, 'calendai_default_development_session_secret_32chars_min')).rejects.toThrow();
    await expect(encryptSession(sampleSession, 'a'.repeat(40))).rejects.toThrow();
    await expect(encryptSession(sampleSession, '')).rejects.toThrow();
  });

  it('encrypts and decrypts session data correctly', async () => {
    const encrypted = await encryptSession(sampleSession, secretKey);
    expect(typeof encrypted).toBe('string');
    expect(encrypted.split('.').length).toBe(5); // JWE compact format has 5 parts

    const decrypted = await decryptSession(encrypted, secretKey);
    expect(decrypted).not.toBeNull();
    expect(decrypted?.user.id).toBe(sampleSession.user.id);
    expect(decrypted?.user.email).toBe(sampleSession.user.email);
    expect(decrypted?.tokens.accessToken).toBe(sampleSession.tokens.accessToken);
    expect(decrypted?.tokens.refreshToken).toBe(sampleSession.tokens.refreshToken);
  });

  it('returns null when decrypting with wrong secret key', async () => {
    const encrypted = await encryptSession(sampleSession, secretKey);
    const wrongSecret = 'another_secret_key_32_chars_long_here_12345';
    const decrypted = await decryptSession(encrypted, wrongSecret);
    expect(decrypted).toBeNull();
  });

  it('returns null on invalid or tampered token', async () => {
    const decrypted = await decryptSession('invalid.tampered.token.data.here', secretKey);
    expect(decrypted).toBeNull();
  });
});
