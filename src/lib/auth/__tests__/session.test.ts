import { describe, expect, it } from 'vitest';
import { decryptSession, encryptSession } from '../session';
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
