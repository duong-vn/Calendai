import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarProposalConflictError, createGoogleCalendarEvent } from '../google-calendar-service';

const input = {
  summary: 'Họp kế hoạch',
  description: 'Thảo luận',
  startDateTime: '2026-10-12T09:00:00+07:00',
  endDateTime: '2026-10-12T10:00:00+07:00',
  timeZone: 'Asia/Ho_Chi_Minh',
  attendees: [{ email: 'partner@example.com' }],
  createMeet: true,
};
const operation = { accountId: 'google-user-1', proposalId: 'proposal-1' };

interface StoredEvent {
  id: string;
  summary: string;
  extendedProperties: { private: Record<string, string> };
  conferenceData?: { createRequest: { requestId: string; status?: { statusCode: string } } };
}

function googleStore(options: { timeoutAfterInsert?: boolean; pending?: boolean } = {}) {
  const events = new Map<string, StoredEvent>();
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as StoredEvent;
      if (events.has(body.id)) return Response.json({ error: { message: 'Duplicate' } }, { status: 409 });
      if (options.pending && body.conferenceData) body.conferenceData.createRequest.status = { statusCode: 'pending' };
      events.set(body.id, body);
      if (options.timeoutAfterInsert) throw new DOMException('Timed out', 'TimeoutError');
      return Response.json(body);
    }
    const event = events.get(url.split('/').pop() ?? '');
    return Response.json(event ?? {}, { status: event ? 200 : 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { events, fetchMock };
}

afterEach(() => vi.unstubAllGlobals());

describe('Google-backed proposal idempotency', () => {
  it('uses one valid stable event ID and Meet request ID across retry and reconciles 409', async () => {
    const { events, fetchMock } = googleStore();
    const first = await createGoogleCalendarEvent('access', input, operation);
    const retry = await createGoogleCalendarEvent('access', input, operation);
    expect(retry.id).toBe(first.id);
    expect(first.id).toMatch(/^[0-9a-f]{64}$/);
    expect(events.size).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${first.id}`);
    const bodies = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies[0].id).toBe(bodies[1].id);
    expect(bodies[0].conferenceData.createRequest.requestId).toBe(bodies[1].conferenceData.createRequest.requestId);
    expect(bodies[0].extendedProperties.private.calendaiPayload).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(bodies[0].extendedProperties)).not.toContain(operation.accountId);
  });

  it('reconciles an uncertain insert after a timeout instead of inserting a new ID', async () => {
    const { events, fetchMock } = googleStore({ timeoutAfterInsert: true });
    const result = await createGoogleCalendarEvent('access', input, operation);
    expect(events.size).toBe(1);
    expect(result.id).toBe([...events.keys()][0]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.method).not.toBe('POST');
  });

  it('does not claim success when an uncertain insert cannot be found', async () => {
    const timeout = new DOMException('Timed out', 'TimeoutError');
    const fetchMock = vi.fn().mockRejectedValueOnce(timeout).mockResolvedValueOnce(Response.json({}, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createGoogleCalendarEvent('access', input, operation)).rejects.toBe(timeout);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent attempts through the same Google event identity', async () => {
    const { events } = googleStore();
    const [first, second] = await Promise.all([
      createGoogleCalendarEvent('access', input, operation),
      createGoogleCalendarEvent('access', input, operation),
    ]);
    expect(first.id).toBe(second.id);
    expect(events.size).toBe(1);
  });

  it.each([
    { summary: 'Đã đổi tiêu đề' },
    { createMeet: false },
    { endDateTime: '2026-10-12T11:00:00+07:00' },
    { attendees: [{ email: 'different@example.com' }] },
  ])('rejects reuse of a proposal ID with different payload %j', async (change) => {
    const { events } = googleStore();
    await createGoogleCalendarEvent('access', input, operation);
    await expect(createGoogleCalendarEvent('access', { ...input, ...change }, operation)).rejects.toBeInstanceOf(CalendarProposalConflictError);
    expect(events.size).toBe(1);
  });

  it.each(['calendaiOwner', 'calendaiOperation', 'calendaiPayload'])('verifies the existing %s marker before success', async (marker) => {
    const { events } = googleStore();
    await createGoogleCalendarEvent('access', input, operation);
    const existing = [...events.values()][0];
    existing.extendedProperties.private[marker] = 'not-ours';
    await expect(createGoogleCalendarEvent('access', input, operation)).rejects.toBeInstanceOf(CalendarProposalConflictError);
  });

  it('partitions proposal identity by authenticated Google account', async () => {
    const { events } = googleStore();
    const first = await createGoogleCalendarEvent('access', input, operation);
    const second = await createGoogleCalendarEvent('access', input, { ...operation, accountId: 'google-user-2' });
    expect(first.id).not.toBe(second.id);
    expect(events.size).toBe(2);
  });

  it('keeps successful Calendar creation separate from pending Meet', async () => {
    googleStore({ pending: true });
    const event = await createGoogleCalendarEvent('access', input, operation);
    expect(event.id).toBeTruthy();
    expect(event.conferenceStatus).toBe('pending');
    expect(event.hangoutLink).toBeUndefined();
  });
});
