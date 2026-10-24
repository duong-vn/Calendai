import { refreshGoogleAccessToken } from '@/lib/auth/google-oauth';
import { mobileErrorResponse, mobileSessionResponse } from '@/lib/auth/mobile';
import { AuthError, getServerSession } from '@/lib/auth/server-session';
import { MobileSessionDataSchema } from '@/lib/auth/types';
import { getServerEnv } from '@/lib/env';

export async function POST(request: Request) {
  try {
    if (!request.headers.has('authorization')) throw new AuthError();
    const session = MobileSessionDataSchema.safeParse(await getServerSession(request));
    if (!session.success) throw new AuthError();
    const env = getServerEnv();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Chưa cấu hình Google trên server.');
    }
    const tokens = await refreshGoogleAccessToken(
      session.data.tokens.refreshToken,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      session.data.tokens.scope
    );
    // Preserve the original absolute horizon; refresh never extends the login lifetime.
    return await mobileSessionResponse(MobileSessionDataSchema.parse({ ...session.data, tokens }));
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
