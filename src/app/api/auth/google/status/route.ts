import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server-session';
import { isGoogleConfigured } from '@/lib/env';

export async function GET() {
  try {
    const session = await getServerSession();
    return NextResponse.json({
      authenticated: Boolean(session),
      user: session?.user ?? null,
      isConfigured: isGoogleConfigured(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
        isConfigured: isGoogleConfigured(),
        error: message,
      },
      { status: 500 }
    );
  }
}
