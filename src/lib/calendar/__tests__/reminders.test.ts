import { describe, expect, it } from 'vitest';
import { ReminderMinutesSchema } from '../reminders';
import { MeetingProposalSchema } from '../proposal-schema';

describe('Reminder validation', () => {
  it.each([{ values: [60, 10] }, { values: [] }, { values: [0] }, { values: [40320] }])('accepts supported settings %j', ({ values }) => {
    expect(ReminderMinutesSchema.safeParse(values).success).toBe(true);
  });
  it.each([{ values: [-1] }, { values: [40321] }, { values: [1.5] }, { values: [10, 10] }, { values: [1, 2, 3, 4, 5, 6] }, { values: ['10'] }])('rejects invalid settings %j', ({ values }) => {
    expect(ReminderMinutesSchema.safeParse(values).success).toBe(false);
  });
  it('preserves explicit empty settings and keeps omitted legacy values absent', () => {
    const proposal = { summary: 'Họp', startDateTime: '2026-11-02T09:00:00+07:00', endDateTime: '2026-11-02T10:00:00+07:00' };
    expect(MeetingProposalSchema.parse(proposal).reminderMinutes).toBeUndefined();
    expect(MeetingProposalSchema.parse({ ...proposal, reminderMinutes: [] }).reminderMinutes).toEqual([]);
  });
});
