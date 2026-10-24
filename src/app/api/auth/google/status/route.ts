import { NextResponse } from 'next/server';
import { authErrorResponse, getServerSession } from '@/lib/auth/server-session';
import { isGoogleConfigured } from '@/lib/env';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(request);
    return NextResponse.json({
      authenticated: Boolean(session),
      user: session?.user ?? null,
      isConfigured: isGoogleConfigured(),
      ...(session?.kind === 'mobile' ? {
        expiresAt: session.expiresAt,
        accessTokenExpiresAt: session.tokens.expiresAt,
      } : {}),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    return NextResponse.json({
      authenticated: false,
      user: null,
      isConfigured: isGoogleConfigured(),
      error: 'Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại sau.',
    }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
