import { z } from 'zod';
import { MeetingProposalSchema, OffsetDateTimeSchema } from './proposal-schema';

export const EventIdSchema = z.string().min(1).max(1024).regex(/^[A-Za-z0-9_-]+$/);
export const EventEtagSchema = z.string().max(1024).regex(/^"[^"\r\n]+"$/);

// Keep this outside MeetingProposalSchema: only explicit true permits an overlap.
export const ConflictOverrideSchema = z.object({ allowConflict: z.boolean().optional().default(false) });

export const ResolveConflictSchema = z.object({
  proposal: MeetingProposalSchema,
  eventId: EventIdSchema,
  etag: EventEtagSchema,
  action: z.enum(['cancel', 'reschedule']),
  startDateTime: OffsetDateTimeSchema.optional(),
  endDateTime: OffsetDateTimeSchema.optional(),
}).superRefine((input, context) => {
  if (input.action === 'reschedule' && (!input.startDateTime || !input.endDateTime ||
    Date.parse(input.endDateTime) <= Date.parse(input.startDateTime))) {
    context.addIssue({ code: 'custom', path: ['endDateTime'], message: 'Vui lòng chọn giờ bắt đầu và kết thúc hợp lệ; giờ kết thúc phải sau giờ bắt đầu.' });
  }
});

export type ResolveConflictInput = z.infer<typeof ResolveConflictSchema>;

export interface CalendarConflict {
  id: string;
  summary: string;
  start: string;
  end: string;
  etag: string;
  timeZone: string;
  isAllDay: boolean;
}
