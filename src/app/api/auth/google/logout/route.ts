import { NextResponse } from 'next/server';
import { authErrorResponse, clearServerSession, getServerSession } from '@/lib/auth/server-session';

export async function POST(request: Request) {
  try {
    if (request?.headers.has('authorization')) {
      // Stateless mobile logout is local deletion, not revocation of every issued JWE.
      await getServerSession(request);
    } else {
      await clearServerSession();
    }
    return NextResponse.json({ success: true, message: 'Đã đăng xuất thành công' }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ success: false, error: 'Không thể đăng xuất. Vui lòng thử lại sau.' }, {
      status: 500, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
