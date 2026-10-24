import { z } from 'zod';

const DEVELOPMENT_SESSION_KEY = 'calendai_default_development_session_secret_32chars_min';

export const SessionKeySchema = z.string().min(32, 'SESSION_SECRET phải có tối thiểu 32 ký tự').refine(
  (value) => process.env.NODE_ENV !== 'production' || (
    value !== DEVELOPMENT_SESSION_KEY &&
    new Set(value).size >= 8 &&
    !/development|default|change.?me|replace.?me|your[_-].*key/i.test(value)
  ),
  'SESSION_SECRET production phải là khóa ngẫu nhiên an toàn, không dùng khóa mẫu hoặc development'
);

export const EnvSchema = z.object({
  SESSION_SECRET: SessionKeySchema.default(DEVELOPMENT_SESSION_KEY),
  AI_API_KEY: z.string().min(1, 'AI_API_KEY không được để trống'),
  AI_MODEL: z.string().min(1, 'AI_MODEL không được để trống'),
  AI_BASE_URL: z.string().url('AI_BASE_URL phải là URL hợp lệ').default('https://api.openai.com/v1'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function getServerEnv(): EnvConfig {
  const parsed = EnvSchema.safeParse({
    AI_API_KEY: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || '',
    AI_MODEL: process.env.AI_MODEL || process.env.OPENROUTER_MODEL || '',
    AI_BASE_URL:
      process.env.AI_BASE_URL ||
      process.env.OPENROUTER_BASE_URL ||
      'https://api.openai.com/v1',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    SESSION_SECRET: process.env.SESSION_SECRET || DEVELOPMENT_SESSION_KEY,
  });

  if (!parsed.success) {
    const errorMessages = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
    throw new Error(`Cấu hình biến môi trường không hợp lệ: ${errorMessages}`);
  }

  return parsed.data;
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
