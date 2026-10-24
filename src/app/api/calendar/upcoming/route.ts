import { NextResponse } from 'next/server';
import { authErrorResponse, getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
import { listGoogleCalendarEvents } from '@/lib/calendar/google-calendar-service';
import { listMockCalendarEvents } from '@/lib/calendar/mock-calendar-service';
import { isGoogleConfigured } from '@/lib/env';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawMaxResults = searchParams.get('maxResults');
    const maxResults = rawMaxResults === null ? 10 : Number(rawMaxResults);
    if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 100) {
      return NextResponse.json({ success: false, error: 'Số lượng sự kiện phải là số nguyên từ 1 đến 100.' }, { status: 400 });
    }
    const session = await getServerSession(request);

    if (session) {
      const { accessToken } = await getValidAccessToken(session, request);
      const events = await listGoogleCalendarEvents(accessToken, { maxResults });
      return NextResponse.json({
        success: true,
        mode: 'google',
        events,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (!request.headers.has('authorization') && process.env.NODE_ENV !== 'production' && !isGoogleConfigured()) {
      const mockEvents = await listMockCalendarEvents();
      return NextResponse.json({
        success: true,
        mode: 'mock',
        events: mockEvents,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Vui lòng kết nối tài khoản Google để xem lịch.',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 }
    );
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const message = 'Không thể lấy danh sách sự kiện. Vui lòng thử lại hoặc kết nối lại Google.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
