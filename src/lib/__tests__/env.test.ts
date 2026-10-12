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

  it('fails when AI_API_KEY is missing', () => {
    delete process.env.AI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    expect(() => getServerEnv()).toThrow('AI_API_KEY không được để trống');
  });

  it('fails when AI_MODEL is missing and no OPENROUTER_MODEL provided', () => {
    process.env.AI_API_KEY = 'test-key';
    delete process.env.AI_MODEL;
    delete process.env.OPENROUTER_MODEL;
    expect(() => getServerEnv()).toThrow('AI_MODEL không được để trống');
  });

  it('parses valid environment variables with default values', () => {
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_MODEL = 'custom-configured-model';
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_MODEL;
    delete process.env.AI_BASE_URL;
    delete process.env.OPENROUTER_BASE_URL;

    const env = getServerEnv();

    expect(env.AI_API_KEY).toBe('test-key');
    expect(env.AI_MODEL).toBe('custom-configured-model');
    expect(env.AI_BASE_URL).toBe('https://api.openai.com/v1');
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
  });

  it('supports legacy OPENROUTER_API_KEY seamlessly', () => {
    delete process.env.AI_API_KEY;
    process.env.OPENROUTER_API_KEY = 'legacy-key';
    process.env.OPENROUTER_MODEL = 'test-model';

    const env = getServerEnv();
    expect(env.AI_API_KEY).toBe('legacy-key');
    expect(env.AI_MODEL).toBe('test-model');
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
