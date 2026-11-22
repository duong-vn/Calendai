import { NextResponse } from 'next/server';
import { requireJsonContentType, requireSameOrigin } from '@/lib/auth/request-guards';
import { authErrorResponse, getServerSession } from '@/lib/auth/server-session';
import type { SessionData } from '@/lib/auth/types';
import {
  CalendarUnauthorizedError,
  calendarUnauthorizedResponse,
  executeWithCalendarAuth,
} from '@/lib/calendar/calendar-auth';
import { ResolveConflictSchema } from '@/lib/calendar/conflict-schema';
import { CalendarOverlapError, CalendarResolveError, CalendarStaleEventError, resolveCalendarConflict } from '@/lib/calendar/conflict-service';

export async function POST(request: Request) {
  let session: SessionData | null = null;
  try {
    const contentTypeError = requireJsonContentType(request);
    if (contentTypeError) return contentTypeError;
    const originError = requireSameOrigin(request, 'Nguồn yêu cầu thay đổi lịch không hợp lệ.');
    if (originError) return originError;
    const input = ResolveConflictSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ success: false, error: 'Thông tin thay đổi lịch không hợp lệ. Vui lòng kiểm tra sự kiện và ngày giờ có múi giờ.' }, { status: 400 });
    }
    session = await getServerSession(request);
    if (!session) {
      return NextResponse.json({ success: false, code: 'AUTH_REQUIRED', error: 'Vui lòng kết nối tài khoản Google để thay đổi lịch.' }, { status: 401 });
    }
    await executeWithCalendarAuth(session, request, (accessToken) =>
      resolveCalendarConflict(accessToken, input.data)
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof CalendarUnauthorizedError) {
      return calendarUnauthorizedResponse(session, request);
    }
    if (error instanceof CalendarStaleEventError) {
      return NextResponse.json({ success: false, code: 'STALE_EVENT', error: error.message }, { status: 409 });
    }
    if (error instanceof CalendarOverlapError) {
      return NextResponse.json({ success: false, code: 'CALENDAR_CONFLICT', conflicts: error.conflicts, error: error.message }, { status: 409 });
    }
    if (error instanceof CalendarResolveError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Chưa xác định được kết quả thay đổi lịch. Vui lòng kiểm tra lại Google Calendar trước khi thử lại.' }, { status: 502 });
  }
}
