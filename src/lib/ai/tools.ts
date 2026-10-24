import { tool } from 'ai';
import { z } from 'zod';
import type { SessionData } from '@/lib/auth/types';
import { listGoogleCalendarEvents } from '@/lib/calendar/google-calendar-service';
import { listMockCalendarEvents } from '@/lib/calendar/mock-calendar-service';
import { MeetingProposalSchema } from '@/lib/calendar/proposal-schema';
import { isGoogleConfigured } from '@/lib/env';

export { AttendeeSchema } from '@/lib/calendar/proposal-schema';
export const ProposeMeetingSchema = MeetingProposalSchema;
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
        'Đề xuất tạo cuộc họp và hiển thị Thẻ xem trước (Preview Card) trên giao diện. Kích hoạt ngay khi có thông tin cơ bản về ngày giờ và hoạt động/chủ đề (tiêu đề có thể tự suy luận ngắn gọn, các tham số khác áp dụng giá trị mặc định).',
      parameters: ProposeMeetingSchema,
      execute: async (args) => {
        const proposal = ProposeMeetingSchema.parse(args);

        return {
          ...proposal,
          proposalId: crypto.randomUUID(),
          startDateTime: new Date(proposal.startDateTime).toISOString(),
          endDateTime: new Date(proposal.endDateTime).toISOString(),
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
              timeMax: new Date(Date.now() + args.daysAhead * 24 * 60 * 60 * 1000).toISOString(),
            });

            return {
              success: true,
              mode: 'google',
              events,
            };
          }

          if (process.env.NODE_ENV !== 'production' && !isGoogleConfigured()) {
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
        } catch {
          return {
            success: false,
            error: 'Không thể lấy dữ liệu lịch. Vui lòng thử lại hoặc kết nối lại tài khoản Google.',
          };
        }
      },
    }),
  };
}
