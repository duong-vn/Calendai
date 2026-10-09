import { tool } from 'ai';
import { z } from 'zod';
import type { SessionData } from '@/lib/auth/types';
import { listGoogleCalendarEvents } from '@/lib/calendar/google-calendar-service';
import { listMockCalendarEvents } from '@/lib/calendar/mock-calendar-service';
import { isGoogleConfigured } from '@/lib/env';

export const AttendeeSchema = z.object({
  email: z.string().email('Địa chỉ email người tham gia không hợp lệ'),
  name: z.string().optional(),
});

export const ProposeMeetingSchema = z.object({
  summary: z.string().min(1, 'Tiêu đề cuộc họp không được để trống'),
  description: z.string().optional().default(''),
  startDateTime: z.string().describe('Thời gian bắt đầu dạng ISO 8601 (ví dụ: 2026-10-12T09:00:00+07:00)'),
  endDateTime: z.string().describe('Thời gian kết thúc dạng ISO 8601 (ví dụ: 2026-10-12T10:00:00+07:00)'),
  timeZone: z.string().default('Asia/Ho_Chi_Minh'),
  attendees: z.array(AttendeeSchema).optional().default([]),
  createMeet: z.boolean().default(true).describe('Tự động tạo Google Meet link'),
});

export type ProposeMeetingInput = z.infer<typeof ProposeMeetingSchema>;

export const ListUpcomingEventsSchema = z.object({
  maxResults: z.number().int().min(1).max(10).default(5).describe('Số lượng sự kiện tối đa cần xem'),
  daysAhead: z.number().int().min(1).max(14).default(7).describe('Khoảng thời gian cần xem tính theo ngày'),
});

export function createCalendarTools(
  session?: SessionData | null,
  accessToken?: string | null
) {
  return {
    proposeMeeting: tool({
      description:
        'Đề xuất tạo cuộc họp và hiển thị Thẻ xem trước (Preview Card) để người dùng xác nhận trên giao diện. Tuyệt đối chỉ gọi tool này khi đã có đủ thông tin tiêu đề và ngày giờ.',
      parameters: ProposeMeetingSchema,
      execute: async (args) => {
        const proposalId = crypto.randomUUID();

        // Kiểm tra startDateTime và endDateTime
        let start = new Date(args.startDateTime);
        let end = new Date(args.endDateTime);

        // Fallback an toàn nếu parse không hợp lệ
        if (isNaN(start.getTime())) {
          start = new Date(Date.now() + 60 * 60 * 1000); // 1 tiếng sau
        }
        if (isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
          end = new Date(start.getTime() + 30 * 60 * 1000); // 30 phút sau start
        }

        return {
          proposalId,
          summary: args.summary,
          description: args.description || '',
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          timeZone: args.timeZone || 'Asia/Ho_Chi_Minh',
          attendees: args.attendees || [],
          createMeet: args.createMeet !== false,
          status: 'proposed',
          message: 'Đã chuẩn bị thông tin cuộc họp. Vui lòng xác nhận để hoàn tất tạo trên Google Calendar.',
        };
      },
    }),

    listUpcomingEvents: tool({
      description: 'Tra cứu danh sách các sự kiện hoặc cuộc họp sắp diễn ra trên Google Calendar của người dùng.',
      parameters: ListUpcomingEventsSchema,
      execute: async (args) => {
        try {
          if (session && accessToken) {
            const events = await listGoogleCalendarEvents(accessToken, {
              maxResults: args.maxResults,
            });

            return {
              success: true,
              mode: 'google',
              events,
            };
          }

          if (!isGoogleConfigured()) {
            const mockEvents = await listMockCalendarEvents();
            return {
              success: true,
              mode: 'mock',
              isMock: true,
              events: mockEvents,
              note: 'Đang hiển thị dữ liệu lịch mẫu (Chưa đăng nhập Google).',
            };
          }

          return {
            success: false,
            error: 'Chưa kết nối tài khoản Google. Vui lòng kết nối tài khoản ở góc trên trang web.',
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Không thể lấy dữ liệu lịch.',
          };
        }
      },
    }),
  };
}
