import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/auth/google-oauth';
import { OAUTH_STATE_COOKIE_NAME } from '@/lib/auth/session';
import { setServerSession } from '@/lib/auth/server-session';
import { getServerEnv } from '@/lib/env';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const homeUrl = new URL('/', request.url);

  try {
    const errorParam = requestUrl.searchParams.get('error');
    if (errorParam) {
      homeUrl.searchParams.set('auth_error', `Google từ chối ủy quyền: ${errorParam}`);
      return NextResponse.redirect(homeUrl);
    }

    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');

    if (!code || !state) {
      homeUrl.searchParams.set('auth_error', 'Thiếu authorization code hoặc state từ phản hồi của Google.');
      return NextResponse.redirect(homeUrl);
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;

    if (!storedState || storedState !== state) {
      homeUrl.searchParams.set(
        'auth_error',
        'Lỗi bảo mật CSRF: State không khớp hoặc đã hết hạn. Vui lòng thử lại.'
      );
      return NextResponse.redirect(homeUrl);
    }

    // Xóa state cookie sau khi kiểm tra xong
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME);

    const env = getServerEnv();
    const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

    const { tokens, user } = await exchangeCodeForTokens(
      code,
      redirectUri,
      env.GOOGLE_CLIENT_ID!,
      env.GOOGLE_CLIENT_SECRET!
    );

    await setServerSession({
      user,
      tokens,
      createdAt: Date.now(),
    });

    homeUrl.searchParams.set('auth_success', 'true');
    return NextResponse.redirect(homeUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xác thực Google thất bại';
    homeUrl.searchParams.set('auth_error', encodeURIComponent(message));
    return NextResponse.redirect(homeUrl);
  }
}
