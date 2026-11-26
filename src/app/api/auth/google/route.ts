import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateOAuthState, getGoogleAuthUrl, GoogleOAuthError } from '@/lib/auth/google-oauth';
import { OAUTH_ERROR_MESSAGES } from '@/lib/auth/oauth-error';
import { OAUTH_STATE_COOKIE_NAME } from '@/lib/auth/session';
import { getServerEnv, isGoogleConfigured } from '@/lib/env';

export async function GET(request: Request) {
  try {
    if (!isGoogleConfigured()) {
      const url = new URL('/', request.url);
      url.searchParams.set('auth_error', 'google_not_configured');
      return NextResponse.redirect(url);
    }

    const env = getServerEnv();
    const state = generateOAuthState();
    const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

    const cookieStore = await cookies();
    cookieStore.set(OAUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60, // 10 minutes for OAuth flow
    });

    const authUrl = getGoogleAuthUrl(state, redirectUri, env.GOOGLE_CLIENT_ID!);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message =
      error instanceof GoogleOAuthError ? error.message : OAUTH_ERROR_MESSAGES.oauth_init_failed;
    const url = new URL('/', request.url);
    url.searchParams.set('auth_error', message);
    return NextResponse.redirect(url);
  }
}
