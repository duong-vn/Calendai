import { tool } from 'ai';
import { z } from 'zod';
import type { SessionData } from '@/lib/auth/types';
import {
  VIETNAM_TIME_ZONE,
  getVietnamThisWeekRange,
  getVietnamTodayRange,
  isEventInTimeRange,
} from '@/lib/calendar/date-range';
import { listGoogleCalendarEvents } from '@/lib/calendar/google-calendar-service';
import { listMockCalendarEvents } from '@/lib/calendar/mock-calendar-service';
import { MeetingProposalSchema, OffsetDateTimeSchema } from '@/lib/calendar/proposal-schema';
import { isGoogleConfigured } from '@/lib/env';

export { AttendeeSchema } from '@/lib/calendar/proposal-schema';
export const ProposeMeetingSchema = MeetingProposalSchema;
export type ProposeMeetingInput = z.infer<typeof ProposeMeetingSchema>;

export const CalendarLookupRangeSchema = z.enum(['today', 'this_week', 'upcoming']);
export type CalendarLookupRange = z.infer<typeof CalendarLookupRangeSchema>;

const DEFAULT_UPCOMING_MAX_RESULTS = 10;
const DEFAULT_DATE_RANGE_MAX_RESULTS = 50;
const DEFAULT_DAYS_AHEAD = 7;

export const ListUpcomingEventsSchema = z.object({
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Số lượng sự kiện tối đa cần xem (mặc định 10 cho lịch sắp tới, 50 cho tra cứu theo ngày/tuần)'),
  range: CalendarLookupRangeSchema
    .optional()
    .describe(
      'Khoảng tra cứu theo múi giờ Việt Nam (Asia/Ho_Chi_Minh): "today" = cả ngày hôm nay từ 00:00 đến trước 00:00 ngày mai (bao gồm sự kiện đã qua trong ngày, không gồm ngày mai); "this_week" = cả tuần này từ Thứ Hai 00:00 đến trước Thứ Hai tuần sau 00:00 (Thứ Hai–Chủ Nhật, bao gồm sự kiện đã qua trong tuần); "upcoming" = từ hiện tại đến daysAhead ngày sắp tới. Không dùng chung với timeMin/timeMax.'
    ),
  daysAhead: z
    .number()
    .int()
    .min(1)
    .max(14)
    .optional()
    .describe('Số ngày sắp tới tính từ hiện tại (1–14 ngày, mặc định 7). Chỉ dùng cho chế độ lịch sắp tới, không dùng chung với timeMin/timeMax hoặc range "today"/"this_week".'),
  timeMin: OffsetDateTimeSchema
    .optional()
    .describe('Mốc bắt đầu khoảng tra cứu dạng ISO 8601 có múi giờ (ví dụ: 2026-11-11T00:00:00+07:00). Phải truyền cùng timeMax và không dùng chung với daysAhead hoặc range.'),
  timeMax: OffsetDateTimeSchema
    .optional()
    .describe('Mốc kết thúc loại trừ (exclusive) dạng ISO 8601 có múi giờ (ví dụ: 2026-11-12T00:00:00+07:00). Phải truyền cùng timeMin và sau timeMin.'),
}).superRefine((value, ctx) => {
  const hasTimeMin = value.timeMin !== undefined;
  const hasTimeMax = value.timeMax !== undefined;

  if (hasTimeMin !== hasTimeMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [hasTimeMin ? 'timeMax' : 'timeMin'],
      message: 'Phải cung cấp đồng thời cả timeMin và timeMax khi tra cứu theo khoảng thời gian cụ thể.',
    });
    return;
  }

  if (hasTimeMin && hasTimeMax) {
    if (Date.parse(value.timeMax!) <= Date.parse(value.timeMin!)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['timeMax'],
        message: 'Thời điểm kết thúc (timeMax) phải sau thời điểm bắt đầu (timeMin).',
      });
    }
    if (value.daysAhead !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['daysAhead'],
        message: 'Không thể kết hợp daysAhead với khoảng thời gian cụ thể timeMin/timeMax.',
      });
    }
    if (value.range !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['range'],
        message: 'Không thể kết hợp range với khoảng thời gian cụ thể timeMin/timeMax.',
      });
    }
    return;
  }

  if ((value.range === 'today' || value.range === 'this_week') && value.daysAhead !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['daysAhead'],
      message: 'Không thể kết hợp daysAhead với khoảng ngày cố định today hoặc this_week.',
    });
  }
});

export type ListUpcomingEventsInput = z.infer<typeof ListUpcomingEventsSchema>;

export function resolveCalendarLookupWindow(
  input: ListUpcomingEventsInput,
  now: Date = new Date()
): {
  timeMin: string;
  timeMax: string;
  maxResults: number;
  timeZone: typeof VIETNAM_TIME_ZONE;
} {
  if (input.timeMin && input.timeMax) {
    return {
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      maxResults: input.maxResults ?? DEFAULT_DATE_RANGE_MAX_RESULTS,
      timeZone: VIETNAM_TIME_ZONE,
    };
  }

  if (input.range === 'today') {
    return {
      ...getVietnamTodayRange(now),
      maxResults: input.maxResults ?? DEFAULT_DATE_RANGE_MAX_RESULTS,
    };
  }

  if (input.range === 'this_week') {
    return {
      ...getVietnamThisWeekRange(now),
      maxResults: input.maxResults ?? DEFAULT_DATE_RANGE_MAX_RESULTS,
    };
  }

  const daysAhead = input.daysAhead ?? DEFAULT_DAYS_AHEAD;
  return {
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString(),
    maxResults: input.maxResults ?? DEFAULT_UPCOMING_MAX_RESULTS,
    timeZone: VIETNAM_TIME_ZONE,
  };
}

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
      description:
        'Tra cứu sự kiện hoặc cuộc họp trên Google Calendar theo ngày hôm nay ("today"), tuần này ("this_week", Thứ Hai–Chủ Nhật theo giờ Việt Nam), khoảng thời gian có múi giờ cụ thể (timeMin/timeMax), hoặc N ngày sắp tới (daysAhead).',
      parameters: ListUpcomingEventsSchema,
      execute: async (args) => {
        const parsed = ListUpcomingEventsSchema.safeParse(args);
        if (!parsed.success) {
          return {
            success: false,
            error: parsed.error.issues[0]?.message || 'Tham số tra cứu lịch không hợp lệ.',
          };
        }

        const { timeMin, timeMax, maxResults, timeZone } = resolveCalendarLookupWindow(parsed.data);

        try {
          if (session && accessToken) {
            const rawEvents = await listGoogleCalendarEvents(accessToken, {
              maxResults,
              timeMin,
              timeMax,
            });
            const events = rawEvents.filter((event) => isEventInTimeRange(event, timeMin, timeMax));

            return {
              success: true,
              mode: 'google',
              timeZone,
              timeMin,
              timeMax,
              events,
            };
          }

          if (process.env.NODE_ENV !== 'production' && !isGoogleConfigured()) {
            const rawMockEvents = await listMockCalendarEvents();
            const mockEvents = rawMockEvents
              .filter((event) => isEventInTimeRange(event, timeMin, timeMax))
              .slice(0, maxResults);
            return {
              success: true,
              mode: 'mock',
              isMock: true,
              timeZone,
              timeMin,
              timeMax,
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
