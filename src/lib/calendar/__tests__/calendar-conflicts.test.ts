import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarLookupError, CalendarOverlapError, CalendarResolveError, CalendarStaleEventError, findCalendarConflicts, rangesOverlap, resolveCalendarConflict } from '../conflict-service';
import { ResolveConflictSchema } from '../conflict-schema';
import { MeetingProposalSchema } from '../proposal-schema';

const proposal = MeetingProposalSchema.parse({
  summary: 'Họp dự án', startDateTime: '2026-10-12T09:00:00+07:00', endDateTime: '2026-10-12T10:00:00+07:00',
});
const existing = {
  id: 'busy-1', etag: '"v1"', summary: 'Lịch bận', status: 'confirmed',
  start: { dateTime: '2026-10-12T09:30:00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
  end: { dateTime: '2026-10-12T10:30:00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
};
const cancel = ResolveConflictSchema.parse({ proposal, eventId: existing.id, etag: existing.etag, action: 'cancel' });
const reschedule = ResolveConflictSchema.parse({ ...cancel, action: 'reschedule', startDateTime: '2026-10-12T11:00:00+07:00', endDateTime: '2026-10-12T12:00:00+07:00' });
const page = (items: unknown[], extra: Record<string, unknown> = {}) => Response.json({ timeZone: 'Asia/Ho_Chi_Minh', items, ...extra });

afterEach(() => vi.unstubAllGlobals());

describe('Blocking calendar overlap lookup', () => {
  it.each([
    ['2026-10-12T08:00:00+07:00', '2026-10-12T09:00:00+07:00', false],
    ['2026-10-12T10:00:00+07:00', '2026-10-12T11:00:00+07:00', false],
    ['2026-10-12T02:00:00Z', '2026-10-12T03:00:00Z', true],
    ['2026-10-12T08:00:00+07:00', '2026-10-12T11:00:00+07:00', true],
  ])('uses exclusive interval boundaries %s / %s', (startDateTime, endDateTime, expected) => {
    expect(rangesOverlap(proposal, { startDateTime, endDateTime })).toBe(expected);
  });

  it('paginates every page and excludes cancelled, free, declined, boundary and own events', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(page([
      { id: 'deleted', status: 'cancelled' },
      { ...existing, id: 'free', transparency: 'transparent' },
      { ...existing, id: 'declined', attendees: [{ self: true, responseStatus: 'declined' }] },
      { ...existing, id: 'own' },
      { ...existing, id: 'adjacent', start: { dateTime: proposal.endDateTime }, end: { dateTime: '2026-10-12T11:00:00+07:00' } },
    ], { nextPageToken: 'page/2' })).mockResolvedValueOnce(page([
      existing, { ...existing, id: 'other-declined', attendees: [{ self: false, responseStatus: 'declined' }] },
    ]));
    vi.stubGlobal('fetch', fetchMock);
    const conflicts = await findCalendarConflicts('access', proposal, ['own']);
    expect(conflicts.map((event) => event.id)).toEqual(['busy-1', 'other-declined']);
    expect(conflicts[0]).toEqual({ id: existing.id, summary: existing.summary, start: existing.start.dateTime, end: existing.end.dateTime, etag: existing.etag, timeZone: 'Asia/Ho_Chi_Minh', isAllDay: false });
    const url = new URL(fetchMock.mock.calls[1][0]);
    expect(url.pathname).toBe('/calendar/v3/calendars/primary/events');
    expect(url.searchParams.get('pageToken')).toBe('page/2');
    expect(url.searchParams.get('singleEvents')).toBe('true');
    expect(url.searchParams.get('timeMin')).toBe(proposal.startDateTime);
  });

  it.each([
    ['Asia/Ho_Chi_Minh', '2026-10-12', '2026-10-13', '2026-10-11T17:00:00.000Z', '2026-10-12T17:00:00.000Z'],
    ['America/New_York', '2026-03-08', '2026-03-09', '2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z'],
  ])('expands all-day dates in calendar timezone including DST %s', async (timeZone, start, end, expectedStart, expectedEnd) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(page([{ ...existing, start: { date: start }, end: { date: end } }], { timeZone })));
    const conflicts = await findCalendarConflicts('access', { startDateTime: expectedStart, endDateTime: expectedEnd });
    expect(conflicts[0]).toMatchObject({ start: expectedStart, end: expectedEnd, timeZone, isAllDay: true });
  });

  it.each([
    {},
    { timeZone: 'Asia/Ho_Chi_Minh', items: 'bad' },
    { timeZone: 'bad-zone', items: [] },
    { timeZone: 'Asia/Ho_Chi_Minh', items: [{ ...existing, etag: undefined }] },
    { timeZone: 'Asia/Ho_Chi_Minh', items: [{ ...existing, end: { dateTime: 'not-a-date' } }] },
    { timeZone: 'Asia/Ho_Chi_Minh', items: [{ ...existing, end: { date: '2026-10-13' } }] },
    { timeZone: 'Asia/Ho_Chi_Minh', items: [], error: { message: 'private diagnostic' } },
  ])('fails closed on invalid provider results %j', async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(data)));
    await expect(findCalendarConflicts('access', proposal)).rejects.toBeInstanceOf(CalendarLookupError);
  });

  it('fails closed on provider failure after a successful page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(page([], { nextPageToken: 'second' })).mockResolvedValueOnce(Response.json({ error: { message: 'private' } }, { status: 503 })));
    await expect(findCalendarConflicts('access', proposal)).rejects.toBeInstanceOf(CalendarLookupError);
  });

  it('fails closed when the pagination safety cap is reached', async () => {
    let nextPage = 0;
    const fetchMock = vi.fn().mockImplementation(async () => page([], { nextPageToken: `page-${++nextPage}` }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(findCalendarConflicts('access', proposal)).rejects.toBeInstanceOf(CalendarLookupError);
    expect(fetchMock).toHaveBeenCalledTimes(100);
  });

  it('rejects repeated pagination tokens rather than returning incomplete results or looping', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => page([], { nextPageToken: 'loop' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(findCalendarConflicts('access', proposal)).rejects.toBeInstanceOf(CalendarLookupError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('Conditional conflict resolution', () => {
  it('GETs actual event and deletes with If-Match and guest updates, never creating an event', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(existing)).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await resolveCalendarConflict('access', cancel);
    expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined();
    expect(fetchMock.mock.calls[1][0]).toContain('/events/busy-1?sendUpdates=all');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE', headers: { 'If-Match': '"v1"' } });
    expect(fetchMock.mock.calls).toHaveLength(2);
  });

  it.each([
    { ...existing, etag: '"v2"' },
    { ...existing, transparency: 'transparent' },
    { ...existing, attendees: [{ self: true, responseStatus: 'declined' }] },
    { ...existing, start: { dateTime: proposal.endDateTime }, end: { dateTime: '2026-10-12T11:00:00+07:00' } },
  ])('does not mutate stale or nonconflicting selection %j', async (event) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(event));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveCalendarConflict('access', cancel)).rejects.toBeInstanceOf(CalendarStaleEventError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propagates conditional write races as stale rather than success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(existing)).mockResolvedValueOnce(Response.json({}, { status: 412 })));
    await expect(resolveCalendarConflict('access', cancel)).rejects.toBeInstanceOf(CalendarStaleEventError);
  });

  it('PATCHes only times, excluding the selected occurrence from its own collision check', async () => {
    const moved = { ...existing, start: { dateTime: reschedule.startDateTime }, end: { dateTime: reschedule.endDateTime }, etag: '"v2"' };
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ ...existing, recurringEventId: 'series-1' }))
      .mockResolvedValueOnce(page([moved])).mockResolvedValueOnce(Response.json(moved));
    vi.stubGlobal('fetch', fetchMock);
    await resolveCalendarConflict('access', reschedule);
    const mutation = fetchMock.mock.calls[2][1];
    expect(mutation).toMatchObject({ method: 'PATCH', headers: { 'If-Match': existing.etag } });
    expect(JSON.parse(String(mutation.body))).toEqual({
      start: { dateTime: reschedule.startDateTime, timeZone: 'Asia/Ho_Chi_Minh', date: null },
      end: { dateTime: reschedule.endDateTime, timeZone: 'Asia/Ho_Chi_Minh', date: null },
    });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('converts a selected all-day occurrence to timed only with explicit dates', async () => {
    const moved = { ...existing, etag: '"v2"', start: { dateTime: reschedule.startDateTime }, end: { dateTime: reschedule.endDateTime } };
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ ...existing, start: { date: '2026-10-12' }, end: { date: '2026-10-13' } }))
      .mockResolvedValueOnce(page([{ ...existing, start: { date: '2026-10-12' }, end: { date: '2026-10-13' } }]))
      .mockResolvedValueOnce(page([])).mockResolvedValueOnce(Response.json(moved));
    vi.stubGlobal('fetch', fetchMock);
    await resolveCalendarConflict('access', reschedule);
    expect(fetchMock.mock.calls[1][0]).toContain('/calendars/primary/events?');
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body)).start).toEqual({ date: null, dateTime: reschedule.startDateTime, timeZone: 'Asia/Ho_Chi_Minh' });
  });

  it('preserves offset-only timed event timezone instead of assigning a different zone', async () => {
    const noZone = { ...existing, start: { dateTime: existing.start.dateTime }, end: { dateTime: existing.end.dateTime } };
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(noZone)).mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(Response.json({ ...noZone, start: { dateTime: reschedule.startDateTime }, end: { dateTime: reschedule.endDateTime } }));
    vi.stubGlobal('fetch', fetchMock);
    await resolveCalendarConflict('access', reschedule);
    const body = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(body.start.timeZone).toBeUndefined();
    expect(body.end.timeZone).toBeUndefined();
  });

  it('fails closed before mutation when replacement collision lookup fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(existing)).mockResolvedValueOnce(Response.json({ error: { message: 'private' } }, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveCalendarConflict('access', reschedule)).rejects.toBeInstanceOf(CalendarLookupError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['cancel', 'reschedule'] as const)('forbids %s on a recurring master', async (action) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ ...existing, recurrence: ['RRULE:FREQ=DAILY'] }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveCalendarConflict('access', { ...reschedule, action })).rejects.toBeInstanceOf(CalendarResolveError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a replacement time that overlaps the pending proposal', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(existing));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveCalendarConflict('access', { ...reschedule, startDateTime: proposal.startDateTime, endDateTime: proposal.endDateTime })).rejects.toBeInstanceOf(CalendarOverlapError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a replacement time overlapping another blocking event', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(existing)).mockResolvedValueOnce(page([
      { ...existing, id: 'another', start: { dateTime: reschedule.startDateTime }, end: { dateTime: reschedule.endDateTime } },
    ]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveCalendarConflict('access', reschedule)).rejects.toBeInstanceOf(CalendarOverlapError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    { startDateTime: undefined }, { endDateTime: undefined },
    { startDateTime: '2026-10-12T11:00:00' }, { startDateTime: '2026-02-30T11:00:00+07:00' },
    { endDateTime: reschedule.startDateTime }, { etag: '*' }, { eventId: '../other' },
  ])('validates mutation inputs %j', (change) => {
    expect(ResolveConflictSchema.safeParse({ ...reschedule, ...change }).success).toBe(false);
  });
});
