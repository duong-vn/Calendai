import { NextResponse } from 'next/server';
import { authErrorResponse, getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
import {
  getVietnamThisWeekRange, getVietnamTodayRange, isEventInTimeRange, VIETNAM_DAY_MS, VIETNAM_UTC_OFFSET,
} from '@/lib/calendar/date-range';
import { listGoogleCalendarEvents } from '@/lib/calendar/google-calendar-service';
import { listMockCalendarEvents } from '@/lib/calendar/mock-calendar-service';
import type { UpcomingEventItem } from '@/lib/calendar/types';
import { isGoogleConfigured } from '@/lib/env';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawMaxResults = searchParams.get('maxResults');
    const maxResults = rawMaxResults === null ? 10 : Number(rawMaxResults);
    if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 100) {
      return NextResponse.json({ success: false, error: 'Số lượng sự kiện phải là số nguyên từ 1 đến 100.' }, { status: 400 });
    }
    const week = searchParams.get('week');
    const weekStart = new Date(`${week}T00:00:00${VIETNAM_UTC_OFFSET}`);
    const range = week && Number.isFinite(weekStart.getTime()) ? getVietnamThisWeekRange(weekStart) : null;
    if (week !== null && (!range || range.timeMin.slice(0, 10) !== week)) {
      return NextResponse.json({ success: false, error: 'Ngày bắt đầu tuần phải là Thứ Hai (YYYY-MM-DD).' }, { status: 400 });
    }
    const withinWeek = (events: UpcomingEventItem[]) => range
      ? events.filter(event => isEventInTimeRange(event, range.timeMin, range.timeMax))
      : events;
    const session = await getServerSession(request);

    if (session) {
      const { accessToken } = await getValidAccessToken(session, request);
      const events = await listGoogleCalendarEvents(accessToken, range ? {
        pageSize: 250,
        paginate: true,
        // Google filters all-day events in the calendar's own timezone.
        timeMin: getVietnamTodayRange(new Date(Date.parse(range.timeMin) - VIETNAM_DAY_MS)).timeMin,
        timeMax: getVietnamTodayRange(new Date(Date.parse(range.timeMax) + VIETNAM_DAY_MS)).timeMin,
      } : { maxResults, paginate: true });
      return NextResponse.json({
        success: true,
        mode: 'google',
        events: withinWeek(events),
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (!request.headers.has('authorization') && process.env.NODE_ENV !== 'production' && !isGoogleConfigured()) {
      const mockEvents = await listMockCalendarEvents();
      return NextResponse.json({
        success: true,
        mode: 'mock',
        events: range ? withinWeek(mockEvents) : mockEvents.slice(0, maxResults),
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
