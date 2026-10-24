import { describe, expect, it } from 'vitest';
import { ProposeMeetingSchema } from '@/lib/ai/tools';
import { MeetingProposalSchema } from '../proposal-schema';

const proposal = {
  summary: 'Họp dự án',
  startDateTime: '2026-10-12T09:00:00+07:00',
  endDateTime: '2026-10-12T10:00:00+07:00',
};

describe('Canonical meeting proposal validation', () => {
  it('is the exact schema used by the AI proposal tool', () => {
    expect(ProposeMeetingSchema).toBe(MeetingProposalSchema);
    expect(MeetingProposalSchema.parse(proposal)).toMatchObject({ timeZone: 'Asia/Ho_Chi_Minh', attendees: [], createMeet: false });
  });

  it.each([
    { startDateTime: 'not-a-date' },
    { startDateTime: '2026-10-12T09:00:00' },
    { startDateTime: '2026-02-30T09:00:00+07:00' },
    { startDateTime: '2026-10-12T09:00:00+25:00' },
    { startDateTime: '2026-10-12T09:00:00+07:99' },
    { startDateTime: '2026-10-12T09:00:00+0700' },
    { endDateTime: '2026-10-12T09:00:00+07:00' },
    { endDateTime: '2026-10-12T08:00:00+07:00' },
    { timeZone: 'Mars/Olympus' },
    { summary: '  ' },
    { summary: 'a'.repeat(201) },
    { proposalId: '' },
    { proposalId: 'a'.repeat(201) },
    { attendees: [{ email: 'not-email' }] },
    { attendees: [{ email: `${'a'.repeat(255)}@example.com` }] },
    { attendees: Array.from({ length: 101 }, () => ({ email: 'person@example.com' })) },
  ])('rejects invalid proposal fields %j', (change) => {
    expect(MeetingProposalSchema.safeParse({ ...proposal, ...change }).success).toBe(false);
  });

  it('compares actual instants rather than clock text', () => {
    expect(MeetingProposalSchema.safeParse({ ...proposal, startDateTime: '2026-10-12T09:00:00+07:00', endDateTime: '2026-10-12T03:00:00Z' }).success).toBe(true);
    expect(MeetingProposalSchema.safeParse({ ...proposal, startDateTime: '2026-10-12T09:00:00+07:00', endDateTime: '2026-10-12T10:00:00+09:00' }).success).toBe(false);
  });
});
