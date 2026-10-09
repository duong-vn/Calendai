import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
import { createGoogleCalendarEvent } from '@/lib/calendar/google-calendar-service';
import { createMockCalendarEvent } from '@/lib/calendar/mock-calendar-service';
import { isGoogleConfigured } from '@/lib/env';

const ConfirmMeetingSchema = z.object({
  summary: z.string().min(1, 'Tiêu đề cuộc họp không được để trống'),
  description: z.string().optional().default(''),
  startDateTime: z.string().min(1, 'Thời gian bắt đầu không hợp lệ'),
  endDateTime: z.string().min(1, 'Thời gian kết thúc không hợp lệ'),
  timeZone: z.string().default('Asia/Ho_Chi_Minh'),
  attendees: z
    .array(
      z.object({
        email: z.string().email('Email người tham gia không hợp lệ'),
        name: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  createMeet: z.boolean().default(true),
  proposalId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json(
        { success: false, error: 'Yêu cầu không hợp lệ: Thiếu dữ liệu JSON.' },
        { status: 400 }
      );
    }

    const parseResult = ConfirmMeetingSchema.safeParse(json);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(
        { success: false, error: `Dữ liệu không hợp lệ: ${issues}` },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const session = await getServerSession();

    // Nếu đã đăng nhập tài khoản Google thực tế
    if (session) {
      const { accessToken } = await getValidAccessToken(session);
      const event = await createGoogleCalendarEvent(accessToken, {
        summary: input.summary,
        description: input.description,
        startDateTime: input.startDateTime,
        endDateTime: input.endDateTime,
        timeZone: input.timeZone,
        attendees: input.attendees,
        createMeet: input.createMeet,
      });

      return NextResponse.json({
        success: true,
        mode: 'google',
        event,
      });
    }

    // Nếu chưa đăng nhập và Google chưa được cấu hình -> hỗ trợ mock cho local development/testing
    if (!isGoogleConfigured()) {
      const mockEvent = await createMockCalendarEvent({
        summary: input.summary,
        description: input.description,
        startDateTime: input.startDateTime,
        endDateTime: input.endDateTime,
        timeZone: input.timeZone,
        attendees: input.attendees,
        createMeet: input.createMeet,
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
    const message = error instanceof Error ? error.message : 'Lỗi hệ thống khi tạo lịch.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
