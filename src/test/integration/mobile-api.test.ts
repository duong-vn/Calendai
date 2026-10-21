import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmMeetingProposal, fetchAuthStatus, fetchUpcomingEvents } from '../../../mobile/src/services/api';

const proposal = { proposalId: 'proposal-1', title: 'Họp', start: '2026-10-21T09:00:00+07:00', end: '2026-10-21T10:00:00+07:00' };

function respond(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe('Mobile API truthfulness and contracts', () => {
  it('returns error, never demo events, on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Mất mạng')));
    expect(await fetchUpcomingEvents()).toEqual({ events: [], error: 'Mất mạng' });
    await expect(fetchAuthStatus()).rejects.toThrow('Mất mạng');
  });

  it('reads actual backend string dates', async () => {
    respond({ success: true, mode: 'google', events: [{ id: '1', summary: 'Họp', start: proposal.start, end: proposal.end, isAllDay: false }] });
    const result = await fetchUpcomingEvents();
    expect(result.error).toBeUndefined();
    expect(result.events[0].start).toBe(proposal.start);
  });

  it('rejects malformed event data and mock mode', async () => {
    respond({ success: true, events: [{ id: '1', summary: 'Họp', start: {}, end: {} }] });
    expect((await fetchUpcomingEvents()).error).toBeTruthy();
    respond({ success: true, mode: 'mock', events: [] });
    expect((await fetchUpcomingEvents()).error).toBeTruthy();
  });

  it('does not report confirmation success on API failure or mock result', async () => {
    respond({ success: false, error: 'Hết phiên' }, 401);
    expect(await confirmMeetingProposal(undefined, proposal)).toEqual({ success: false, error: 'Hết phiên' });
    respond({ success: true, isMock: true });
    expect((await confirmMeetingProposal(undefined, proposal)).success).toBe(false);
  });

  it('submits backend confirmation fields and requires valid returned event', async () => {
    respond({ success: true, event: { id: 'created', summary: 'Họp', start: proposal.start, end: proposal.end } });
    expect((await confirmMeetingProposal(undefined, proposal)).success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/calendar/confirm'), expect.objectContaining({ body: JSON.stringify({ proposalId: 'proposal-1', summary: proposal.title, startDateTime: proposal.start, endDateTime: proposal.end, timeZone: 'Asia/Ho_Chi_Minh' }) }));
    respond({ success: true });
    expect((await confirmMeetingProposal(undefined, proposal)).success).toBe(false);
  });
});
