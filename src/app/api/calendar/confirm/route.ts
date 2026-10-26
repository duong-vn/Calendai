import { NextResponse } from 'next/server';
import { authErrorResponse, getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
import { CalendarProposalConflictError, createGoogleCalendarEvent } from '@/lib/calendar/google-calendar-service';
import { createMockCalendarEvent } from '@/lib/calendar/mock-calendar-service';
import { MeetingProposalSchema } from '@/lib/calendar/proposal-schema';
import { isGoogleConfigured } from '@/lib/env';
import { ConflictOverrideSchema } from '@/lib/calendar/conflict-schema';
import { CalendarOverlapError, findCalendarConflicts } from '@/lib/calendar/conflict-service';

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json(
        { success: false, error: 'Yêu cầu không hợp lệ: Thiếu dữ liệu JSON.' },
        { status: 400 }
      );
    }

    // Preserve the legacy confirmation default; the proposal tool defaults to no Meet.
    const legacyInput = typeof json === 'object' && !Array.isArray(json)
      ? { createMeet: true, ...json }
      : json;
    const parseResult = MeetingProposalSchema.safeParse(legacyInput);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(
        { success: false, error: `Dữ liệu không hợp lệ: ${issues}` },
        { status: 400 }
      );
    }

    const override = ConflictOverrideSchema.safeParse(json);
    if (!override.success) {
      return NextResponse.json({ success: false, error: 'Lựa chọn cho phép trùng lịch không hợp lệ.' }, { status: 400 });
    }
    const input = parseResult.data;
    const session = await getServerSession(request);

    // Nếu đã đăng nhập tài khoản Google thực tế
    if (session) {
      const { accessToken } = await getValidAccessToken(session, request);
      const event = await createGoogleCalendarEvent(accessToken, {
        summary: input.summary,
        description: input.description,
        startDateTime: input.startDateTime,
        endDateTime: input.endDateTime,
        timeZone: input.timeZone,
        attendees: input.attendees.map((attendee) => ({ email: attendee.email, displayName: attendee.name })),
        createMeet: input.createMeet,
        reminderMinutes: input.reminderMinutes,
      }, input.proposalId ? { accountId: session.user.id, proposalId: input.proposalId } : undefined, async (eventId) => {
        if (override.data.allowConflict) return;
        const conflicts = await findCalendarConflicts(accessToken, input, eventId ? [eventId] : []);
        if (conflicts.length) throw new CalendarOverlapError(conflicts);
      });

      return NextResponse.json({
        success: true,
        mode: 'google',
        event,
      });
    }

    // Nếu chưa đăng nhập và Google chưa được cấu hình -> hỗ trợ mock cho local development/testing
    if (!request.headers.has('authorization') && process.env.NODE_ENV !== 'production' && !isGoogleConfigured()) {
      const mockEvent = await createMockCalendarEvent({
        summary: input.summary,
        description: input.description,
        startDateTime: input.startDateTime,
        endDateTime: input.endDateTime,
        timeZone: input.timeZone,
        attendees: input.attendees.map((attendee) => ({ email: attendee.email, displayName: attendee.name })),
        createMeet: input.createMeet,
        reminderMinutes: input.reminderMinutes,
      });

      return NextResponse.json({
        success: true,
        mode: 'mock',
        isMock: true,
        message: 'Lưu ý: Sự kiện được tạo ở chế độ Mock (Chưa cấu hình Google Cloud OAuth).',
        event: mockEvent,
      });
    }

    // Chưa đăng nhập mà Google đã cấu hình -> yêu cầu đăng nhập
    return NextResponse.json(
      {
        success: false,
        error: 'Vui lòng kết nối tài khoản Google để tạo sự kiện lên Google Calendar.',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 }
    );
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof CalendarOverlapError) {
      return NextResponse.json({ success: false, code: 'CALENDAR_CONFLICT', conflicts: error.conflicts, error: error.message }, { status: 409 });
    }
    if (error instanceof CalendarProposalConflictError) {
      return NextResponse.json({ success: false, error: error.message, code: 'PROPOSAL_CONFLICT' }, { status: 409 });
    }
    const message = 'Chưa xác định được kết quả tạo lịch. Vui lòng thử lại cùng bản thảo hoặc kiểm tra Google Calendar.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
