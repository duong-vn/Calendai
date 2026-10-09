import { NextResponse } from 'next/server';
import { getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
import { listGoogleCalendarEvents } from '@/lib/calendar/google-calendar-service';
import { listMockCalendarEvents } from '@/lib/calendar/mock-calendar-service';
import { isGoogleConfigured } from '@/lib/env';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const maxResults = Number(searchParams.get('maxResults')) || 10;
    const session = await getServerSession();

    if (session) {
      const { accessToken } = await getValidAccessToken(session);
      const events = await listGoogleCalendarEvents(accessToken, { maxResults });
      return NextResponse.json({
        success: true,
        mode: 'google',
        events,
      });
    }

    if (!isGoogleConfigured()) {
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
    const message = error instanceof Error ? error.message : 'Lỗi lấy danh sách sự kiện.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
