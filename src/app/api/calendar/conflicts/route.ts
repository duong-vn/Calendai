import { NextResponse } from 'next/server';
import { authErrorResponse, getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
import { findCalendarConflicts } from '@/lib/calendar/conflict-service';
import { calendarProposalEventId } from '@/lib/calendar/google-calendar-service';
import { MeetingProposalSchema } from '@/lib/calendar/proposal-schema';
import { isGoogleConfigured } from '@/lib/env';

export async function POST(request: Request) {
  try {
    const input = MeetingProposalSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ success: false, error: 'Thông tin đề xuất không hợp lệ. Vui lòng kiểm tra ngày giờ và múi giờ.' }, { status: 400 });
    }
    const session = await getServerSession(request);
    if (!session) {
      if (!request.headers.has('authorization') && process.env.NODE_ENV !== 'production' && !isGoogleConfigured()) {
        return NextResponse.json({ success: true, conflicts: [], mode: 'mock', isMock: true });
      }
      return NextResponse.json({ success: false, code: 'AUTH_REQUIRED', error: 'Vui lòng kết nối tài khoản Google để kiểm tra lịch.' }, { status: 401 });
    }
    const { accessToken } = await getValidAccessToken(session, request);
    const excludeIds = input.data.proposalId ? [calendarProposalEventId(session.user.id, input.data.proposalId)] : [];
    const conflicts = await findCalendarConflicts(accessToken, input.data, excludeIds);
    return NextResponse.json({ success: true, conflicts });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ success: false, error: 'Không thể kiểm tra lịch Google lúc này. Vui lòng thử lại.' }, { status: 502 });
  }
}
