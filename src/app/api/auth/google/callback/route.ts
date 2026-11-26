import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { exchangeCodeForTokens, GoogleOAuthError } from '@/lib/auth/google-oauth';
import { OAUTH_ERROR_MESSAGES, sanitizeGoogleCallbackErrorParam } from '@/lib/auth/oauth-error';
import { OAUTH_STATE_COOKIE_NAME } from '@/lib/auth/session';
import { setServerSession } from '@/lib/auth/server-session';
import { getServerEnv } from '@/lib/env';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const homeUrl = new URL('/', request.url);

  try {
    const errorParam = requestUrl.searchParams.get('error');
    if (errorParam !== null) {
      homeUrl.searchParams.set('auth_error', sanitizeGoogleCallbackErrorParam(errorParam));
      return NextResponse.redirect(homeUrl);
    }

    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');

    if (!code || !state) {
      homeUrl.searchParams.set('auth_error', OAUTH_ERROR_MESSAGES.missing_oauth_params);
      return NextResponse.redirect(homeUrl);
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;

    if (!storedState || storedState !== state) {
      homeUrl.searchParams.set('auth_error', OAUTH_ERROR_MESSAGES.csrf_mismatch);
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
    const message =
      error instanceof GoogleOAuthError ? error.message : OAUTH_ERROR_MESSAGES.oauth_failed;
    homeUrl.searchParams.set('auth_error', message);
    return NextResponse.redirect(homeUrl);
  }
}
