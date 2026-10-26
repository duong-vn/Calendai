import { NextResponse } from 'next/server';
import { authErrorResponse, getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
import { ResolveConflictSchema } from '@/lib/calendar/conflict-schema';
import { CalendarOverlapError, CalendarResolveError, CalendarStaleEventError, resolveCalendarConflict } from '@/lib/calendar/conflict-service';

export async function POST(request: Request) {
  try {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) {
      return NextResponse.json({ success: false, error: 'Yêu cầu phải sử dụng dữ liệu JSON.' }, { status: 415 });
    }
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) {
      return NextResponse.json({ success: false, error: 'Nguồn yêu cầu thay đổi lịch không hợp lệ.' }, { status: 403 });
    }
    const input = ResolveConflictSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ success: false, error: 'Thông tin thay đổi lịch không hợp lệ. Vui lòng kiểm tra sự kiện và ngày giờ có múi giờ.' }, { status: 400 });
    }
    const session = await getServerSession(request);
    if (!session) {
      return NextResponse.json({ success: false, code: 'AUTH_REQUIRED', error: 'Vui lòng kết nối tài khoản Google để thay đổi lịch.' }, { status: 401 });
    }
    const { accessToken } = await getValidAccessToken(session, request);
    await resolveCalendarConflict(accessToken, input.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
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
