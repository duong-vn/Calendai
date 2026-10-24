import { describe, expect, it } from 'vitest';
import { parseEvent, parseProposal } from '../../../mobile/src/types';

const proposal = {
  proposalId: 'proposal-1', summary: 'Họp',
  startDateTime: '2026-10-21T09:00:00+07:00', endDateTime: '2026-10-21T10:00:00+07:00',
  timeZone: 'Asia/Ho_Chi_Minh', attendees: [], createMeet: false,
};

describe('Shared mobile Calendar payload boundaries', () => {
  it('accepts canonical backend proposal fields without renaming dates', () => {
    expect(parseProposal(proposal)).toMatchObject(proposal);
  });

  it('reads backend string event dates', () => {
    expect(parseEvent({ id: 'event-1', summary: 'Họp', start: proposal.startDateTime, end: proposal.endDateTime }).start).toBe(proposal.startDateTime);
  });

  it('rejects malformed event and proposal dates', () => {
    expect(() => parseEvent({ id: 'event-1', summary: 'Họp', start: {}, end: {} })).toThrow();
    expect(() => parseProposal({ ...proposal, endDateTime: proposal.startDateTime })).toThrow();
    expect(() => parseProposal({ ...proposal, startDateTime: '2026-10-21T09:00:00' })).toThrow();
    expect(() => parseProposal({ ...proposal, summary: 'a'.repeat(201) })).toThrow();
  });
});
