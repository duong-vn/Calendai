import { exchangeNativeCodeForTokens } from '@/lib/auth/google-oauth';
import { mobileErrorResponse, mobileSessionResponse, readMobileExchangeCode } from '@/lib/auth/mobile';
import { SESSION_EXPIRATION_SECONDS } from '@/lib/auth/session';
import { MobileSessionDataSchema } from '@/lib/auth/types';
import { getServerEnv } from '@/lib/env';

export async function POST(request: Request) {
  try {
    const code = await readMobileExchangeCode(request);
    const env = getServerEnv();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Chưa cấu hình Google trên server.');
    }
    const { tokens, user } = await exchangeNativeCodeForTokens(code, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
    const createdAt = Date.now();
    const session = MobileSessionDataSchema.parse({
      kind: 'mobile', user, tokens, createdAt,
      expiresAt: createdAt + SESSION_EXPIRATION_SECONDS * 1000,
    });
    return await mobileSessionResponse(session);
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
