import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getServerEnv, isGoogleConfigured } from '../env';

describe('Environment Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('fails when OPENROUTER_API_KEY is missing', () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(() => getServerEnv()).toThrow('OPENROUTER_API_KEY không được để trống');
  });

  it('parses valid environment variables with default values', () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const env = getServerEnv();

    expect(env.OPENROUTER_API_KEY).toBe('test-key');
    expect(env.OPENROUTER_MODEL).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
    expect(env.OPENROUTER_BASE_URL).toBe('https://openrouter.ai/api/v1');
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
  });

  it('correctly determines whether Google OAuth is configured', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(isGoogleConfigured()).toBe(false);

    process.env.GOOGLE_CLIENT_ID = 'id-123';
    expect(isGoogleConfigured()).toBe(false);

    process.env.GOOGLE_CLIENT_SECRET = 'sec-123';
    expect(isGoogleConfigured()).toBe(true);
  });
});
