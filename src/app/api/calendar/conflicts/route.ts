import { NextResponse } from 'next/server';
import { requireJsonContentType, requireSameOrigin } from '@/lib/auth/request-guards';
import { authErrorResponse, getServerSession } from '@/lib/auth/server-session';
import type { SessionData } from '@/lib/auth/types';
import {
  CalendarUnauthorizedError,
  calendarUnauthorizedResponse,
  executeWithCalendarAuth,
} from '@/lib/calendar/calendar-auth';
import { findCalendarConflicts } from '@/lib/calendar/conflict-service';
import { calendarProposalEventId } from '@/lib/calendar/google-calendar-service';
import { MeetingProposalSchema } from '@/lib/calendar/proposal-schema';
import { isGoogleConfigured } from '@/lib/env';

export async function POST(request: Request) {
  let session: SessionData | null = null;
  try {
    const contentTypeError = requireJsonContentType(request);
    if (contentTypeError) return contentTypeError;
    const originError = requireSameOrigin(request, 'Nguồn yêu cầu kiểm tra lịch không hợp lệ.', {
      'Cache-Control': 'no-store',
    });
    if (originError) return originError;

    const input = MeetingProposalSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ success: false, error: 'Thông tin đề xuất không hợp lệ. Vui lòng kiểm tra ngày giờ và múi giờ.' }, { status: 400 });
    }
    session = await getServerSession(request);
    if (!session) {
      if (!request.headers.has('authorization') && process.env.NODE_ENV !== 'production' && !isGoogleConfigured()) {
        return NextResponse.json({ success: true, conflicts: [], mode: 'mock', isMock: true });
      }
      return NextResponse.json({ success: false, code: 'AUTH_REQUIRED', error: 'Vui lòng kết nối tài khoản Google để kiểm tra lịch.' }, { status: 401 });
    }
    const excludeIds = input.data.proposalId ? [calendarProposalEventId(session.user.id, input.data.proposalId)] : [];
    const conflicts = await executeWithCalendarAuth(session, request, (accessToken) =>
      findCalendarConflicts(accessToken, input.data, excludeIds)
    );
    return NextResponse.json({ success: true, conflicts });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof CalendarUnauthorizedError) {
      return calendarUnauthorizedResponse(session, request);
    }
    return NextResponse.json({ success: false, error: 'Không thể kiểm tra lịch Google lúc này. Vui lòng thử lại.' }, { status: 502 });
  }
}
