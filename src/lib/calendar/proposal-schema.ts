import { z } from 'zod';

const OffsetDateTimeSchema = z
  .string()
  .max(64, 'Thời gian quá dài')
  .datetime({ offset: true, message: 'Thời gian phải là ngày giờ ISO 8601 hợp lệ có múi giờ (Z hoặc +07:00)' })
  .refine(
    (value) => /(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) && Number.isFinite(Date.parse(value)),
    'Độ lệch múi giờ không hợp lệ'
  );

export const AttendeeSchema = z.object({
  email: z.string().max(254, 'Email người tham gia quá dài').email('Địa chỉ email người tham gia không hợp lệ'),
  name: z.string().max(200, 'Tên người tham gia quá dài').optional(),
});

export const MeetingProposalSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(1, 'Tiêu đề cuộc họp không được để trống')
    .max(200, 'Tiêu đề cuộc họp quá dài')
    .describe('Tiêu đề cuộc họp hoặc hoạt động (tự suy luận ngắn gọn từ lời người dùng nếu không có tiêu đề chính thức)'),
  description: z.string().max(10000, 'Mô tả cuộc họp quá dài').optional().default(''),
  startDateTime: OffsetDateTimeSchema.describe('Thời gian bắt đầu dạng ISO 8601 có offset +07:00 (ví dụ: 2026-10-12T09:00:00+07:00)'),
  endDateTime: OffsetDateTimeSchema.describe('Thời gian kết thúc dạng ISO 8601 có offset +07:00 (mặc định sau startDateTime 60 phút nếu chưa rõ thời lượng)'),
  timeZone: z.string().min(1, 'Múi giờ không hợp lệ').max(100, 'Múi giờ quá dài').refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Múi giờ không hợp lệ').default('Asia/Ho_Chi_Minh'),
  attendees: z.array(AttendeeSchema).max(100, 'Chỉ hỗ trợ tối đa 100 người tham gia').optional().default([]),
  createMeet: z.boolean().default(false).describe('Tạo Google Meet link (mặc định false, chỉ bật true khi người dùng yêu cầu họp online/Meet)'),
  proposalId: z.string().min(1, 'Mã đề xuất không được để trống').max(200, 'Mã đề xuất quá dài').optional(),
}).refine(
  (proposal) => Date.parse(proposal.endDateTime) > Date.parse(proposal.startDateTime),
  { message: 'Thời gian kết thúc phải sau thời gian bắt đầu', path: ['endDateTime'] }
);

export type MeetingProposalInput = z.infer<typeof MeetingProposalSchema>;
