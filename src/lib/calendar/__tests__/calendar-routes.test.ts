// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/calendar/confirm/route';
import { GET } from '@/app/api/calendar/upcoming/route';
import { authErrorResponse, getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
import { createMockCalendarEvent, listMockCalendarEvents } from '../mock-calendar-service';

vi.mock('@/lib/auth/server-session', () => ({
  getServerSession: vi.fn(),
  getValidAccessToken: vi.fn(),
  authErrorResponse: vi.fn(),
}));
vi.mock('@/lib/env', () => ({ isGoogleConfigured: () => false }));
vi.mock('../mock-calendar-service', () => ({ createMockCalendarEvent: vi.fn(), listMockCalendarEvents: vi.fn() }));

const session = {
  user: { id: 'google-account', email: 'person@example.com', name: 'Người dùng' },
  tokens: { accessToken: 'access', expiresAt: Date.now() + 3600000, tokenType: 'Bearer' as const, scope: 'calendar' },
  createdAt: Date.now(),
};
const proposal = {
  proposalId: 'proposal-route-1',
  summary: 'Họp dự án',
  startDateTime: '2026-10-12T09:00:00+07:00',
  endDateTime: '2026-10-12T10:00:00+07:00',
  createMeet: false,
};
function confirm(body: unknown = proposal, authorization?: string) {
  return new Request('http://localhost/api/calendar/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(session);
  vi.mocked(getValidAccessToken).mockResolvedValue({ accessToken: 'access' });
  vi.mocked(authErrorResponse).mockReturnValue(null);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Calendar route boundaries', () => {
  it('loads every page for a Vietnam week and excludes events beyond its date boundaries', async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({
        items: [
          { id: 'overnight', start: { dateTime: '2026-11-15T23:30:00+07:00' }, end: { dateTime: '2026-11-16T00:30:00+07:00' } },
          { id: 'previous', start: { date: '2026-11-15' }, end: { date: '2026-11-16' } },
        ],
        nextPageToken: 'next/page',
      }))
      .mockResolvedValueOnce(Response.json({
        items: [
          { id: 'sunday', start: { date: '2026-11-22' }, end: { date: '2026-11-23' } },
          { id: 'following', start: { dateTime: '2026-11-23T00:00:00+07:00' }, end: { dateTime: '2026-11-23T01:00:00+07:00' } },
        ],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request('http://localhost/api/calendar/upcoming?week=2026-11-16'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect((await response.json()).events.map((event: { id: string }) => event.id)).toEqual(['overnight', 'sunday']);
    const [first, second] = fetchMock.mock.calls.map(([url]) => new URL(url).searchParams);
    expect(first.get('timeMin')).toBe('2026-11-15T00:00:00+07:00');
    expect(first.get('timeMax')).toBe('2026-11-24T00:00:00+07:00');
    expect(second.get('pageToken')).toBe('next/page');
  });

  it('collects every event in a Vietnam week across multiple pages without truncating at pageSize 250', async () => {
    const firstPage = Array.from({ length: 250 }, (_, index) => ({
      id: `wk-1-${index}`,
      start: { dateTime: '2026-11-16T09:00:00+07:00' },
      end: { dateTime: '2026-11-16T10:00:00+07:00' },
    }));
    const secondPage = Array.from({ length: 15 }, (_, index) => ({
      id: `wk-2-${index}`,
      start: { dateTime: '2026-11-17T09:00:00+07:00' },
      end: { dateTime: '2026-11-17T10:00:00+07:00' },
    }));
    const fetchMock = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ items: firstPage, nextPageToken: 'wk-page-2' }))
      .mockResolvedValueOnce(Response.json({ items: secondPage }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request('http://localhost/api/calendar/upcoming?week=2026-11-16'));
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = await response.json() as { events: Array<{ id: string }> };
    expect(body.events).toHaveLength(265);
    expect(body.events[264].id).toBe('wk-2-14');
  });

  it('paginates upcoming events across empty and short pages up to maxResults without extra fetches', async () => {
    const emptyFirstFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'next' }))
      .mockResolvedValueOnce(Response.json({
        items: [
          { id: 'upcoming-1', summary: 'Họp sau trang rỗng', start: { dateTime: '2026-11-16T09:00:00+07:00' }, end: { dateTime: '2026-11-16T10:00:00+07:00' } },
        ],
      }));
    vi.stubGlobal('fetch', emptyFirstFetch);

    const emptyFirstRes = await GET(new Request('http://localhost/api/calendar/upcoming?maxResults=5'));
    expect(emptyFirstRes.status).toBe(200);
    expect(emptyFirstFetch).toHaveBeenCalledTimes(2);
    expect(new URL(emptyFirstFetch.mock.calls[1][0]).searchParams.get('pageToken')).toBe('next');
    expect((await emptyFirstRes.json()).events.map((event: { id: string }) => event.id)).toEqual(['upcoming-1']);

    const shortPageFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({
        items: [
          { id: 'u-1', start: { dateTime: '2026-11-16T09:00:00+07:00' }, end: { dateTime: '2026-11-16T10:00:00+07:00' } },
        ],
        nextPageToken: 'p2',
      }))
      .mockResolvedValueOnce(Response.json({
        items: [
          { id: 'u-2', start: { dateTime: '2026-11-16T11:00:00+07:00' }, end: { dateTime: '2026-11-16T12:00:00+07:00' } },
          { id: 'u-3', start: { dateTime: '2026-11-16T13:00:00+07:00' }, end: { dateTime: '2026-11-16T14:00:00+07:00' } },
          { id: 'u-4', start: { dateTime: '2026-11-16T15:00:00+07:00' }, end: { dateTime: '2026-11-16T16:00:00+07:00' } },
        ],
        nextPageToken: 'p3',
      }));
    vi.stubGlobal('fetch', shortPageFetch);

    const shortPageRes = await GET(new Request('http://localhost/api/calendar/upcoming?maxResults=3'));
    expect(shortPageRes.status).toBe(200);
    expect(shortPageFetch).toHaveBeenCalledTimes(2);
    expect((await shortPageRes.json()).events.map((event: { id: string }) => event.id)).toEqual(['u-1', 'u-2', 'u-3']);

    const fullFirstPageFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({
        items: [
          { id: 'f-1', start: { dateTime: '2026-11-16T09:00:00+07:00' }, end: { dateTime: '2026-11-16T10:00:00+07:00' } },
          { id: 'f-2', start: { dateTime: '2026-11-16T11:00:00+07:00' }, end: { dateTime: '2026-11-16T12:00:00+07:00' } },
        ],
        nextPageToken: 'p2',
      }));
    vi.stubGlobal('fetch', fullFirstPageFetch);

    const fullFirstPageRes = await GET(new Request('http://localhost/api/calendar/upcoming?maxResults=2'));
    expect(fullFirstPageRes.status).toBe(200);
    expect(fullFirstPageFetch).toHaveBeenCalledTimes(1);
    expect((await fullFirstPageRes.json()).events.map((event: { id: string }) => event.id)).toEqual(['f-1', 'f-2']);
  });

  it('returns an error rather than a false empty upcoming list when pagination fails or loops', async () => {
    vi.stubGlobal('fetch', vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'next' }))
      .mockResolvedValueOnce(Response.json({ error: { message: 'backend down' } }, { status: 500 })));

    const failedPageRes = await GET(new Request('http://localhost/api/calendar/upcoming'));
    expect(failedPageRes.status).toBe(500);
    expect(await failedPageRes.json()).toMatchObject({ success: false });

    vi.stubGlobal('fetch', vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'repeat' }))
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'repeat' })));

    const repeatedTokenRes = await GET(new Request('http://localhost/api/calendar/upcoming'));
    expect(repeatedTokenRes.status).toBe(500);
    expect(await repeatedTokenRes.json()).toMatchObject({ success: false });
  });

  it.each(['', '2026-11-15', '2026-02-30', '2026-11-16T00:00:00Z'])('rejects an invalid week %s before contacting Google', async (week) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await GET(new Request(`http://localhost/api/calendar/upcoming?week=${week}`))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([{ reminderMinutes: [30, 5] }, { reminderMinutes: [] }])('passes reminder settings to Google %j', async ({ reminderMinutes }) => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST'
      ? Response.json({ ...JSON.parse(String(init.body)), id: 'created' })
      : Response.json({}, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await POST(confirm({ ...proposal, reminderMinutes, allowConflict: true }))).status).toBe(200);
    const inserted = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(inserted?.[1]?.body)).reminders).toEqual({ useDefault: false, overrides: reminderMinutes.map(minutes => ({ method: 'popup', minutes })) });
  });
  it('passes Request to shared auth and reconciles actual stable inserts, returning 409 for changed payload', async () => {
    let stored: Record<string, unknown> | undefined;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('?') && init?.method !== 'POST') return Response.json({ timeZone: 'Asia/Ho_Chi_Minh', items: [] });
      if (init?.method !== 'POST' && !stored) return Response.json({}, { status: 404 });
      if (init?.method === 'POST') {
        if (stored) return Response.json({ error: { message: 'Duplicate' } }, { status: 409 });
        stored = JSON.parse(String(init.body)) as Record<string, unknown>;
      }
      return Response.json(stored);
    });
    vi.stubGlobal('fetch', fetchMock);
    const request = confirm();
    const first = await POST(request);
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(vi.mocked(getServerSession)).toHaveBeenCalledWith(request);
    expect(vi.mocked(getValidAccessToken)).toHaveBeenCalledWith(session, request);
    const retry = await POST(confirm());
    expect(retry.status).toBe(200);
    expect((await retry.json()).event.id).toBe(firstBody.event.id);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const conflict = await POST(confirm({ ...proposal, summary: 'Nội dung mới' }));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ success: false, code: 'PROPOSAL_CONFLICT' });
    expect(createMockCalendarEvent).not.toHaveBeenCalled();
  });

  it('does not expose private provider diagnostics on Calendar failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { message: 'private diagnostic' } }, { status: 400 })));
    const response = await POST(confirm());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private diagnostic');
    const upcoming = await GET(new Request('http://localhost/api/calendar/upcoming'));
    expect(upcoming.status).toBe(500);
    expect(await upcoming.text()).not.toContain('private diagnostic');
  });

  it('supports legacy confirmations without proposalId', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST'
      ? Response.json({ ...JSON.parse(String(init.body)), id: 'legacy-created' })
      : Response.json({ timeZone: 'Asia/Ho_Chi_Minh', items: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const { proposalId: _ignored, ...legacy } = proposal;
    const response = await POST(confirm(legacy));
    expect(response.status).toBe(200);
    const insert = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(insert?.[1]?.body)).id).toBeUndefined();
  });

  it.each([
    { startDateTime: '2026-10-12T09:00:00' },
    { startDateTime: '2026-02-30T09:00:00+07:00' },
    { endDateTime: proposal.startDateTime },
    { timeZone: 'invalid-zone' },
    { attendees: [{ email: 'invalid' }] },
  ])('rejects invalid confirmation without creating an event %j', async (change) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await POST(confirm({ ...proposal, ...change }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createMockCalendarEvent).not.toHaveBeenCalled();
  });

  it('preserves explicitly marked mock mode for unauthenticated local web requests only', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(createMockCalendarEvent).mockResolvedValue({ id: 'mock-1', summary: 'Họp', start: proposal.startDateTime, end: proposal.endDateTime, timeZone: 'Asia/Ho_Chi_Minh', htmlLink: '', status: 'confirmed' });
    vi.mocked(listMockCalendarEvents).mockResolvedValue([]);
    const response = await POST(confirm());
    expect(await response.json()).toMatchObject({ success: true, mode: 'mock', isMock: true });
    const upcoming = await GET(new Request('http://localhost/api/calendar/upcoming'));
    expect(await upcoming.json()).toMatchObject({ success: true, mode: 'mock' });
  });

  it('never falls back to mock for Bearer requests with no resolved session', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect((await POST(confirm(proposal, 'Bearer invalid'))).status).toBe(401);
    expect((await GET(new Request('http://localhost/api/calendar/upcoming', { headers: { Authorization: 'Bearer invalid' } }))).status).toBe(401);
    expect(createMockCalendarEvent).not.toHaveBeenCalled();
    expect(listMockCalendarEvents).not.toHaveBeenCalled();
  });

  it('returns shared auth errors rather than anonymous results or generic 500', async () => {
    const error = new Error('invalid bearer');
    vi.mocked(getServerSession).mockRejectedValue(error);
    vi.mocked(authErrorResponse).mockImplementation(() => Response.json({ success: false, code: 'AUTH_INVALID' }, { status: 401 }));
    expect((await POST(confirm(proposal, 'Bearer invalid'))).status).toBe(401);
    expect((await GET(new Request('http://localhost/api/calendar/upcoming', { headers: { Authorization: 'Bearer invalid' } }))).status).toBe(401);
    expect(authErrorResponse).toHaveBeenCalledWith(error);
    expect(createMockCalendarEvent).not.toHaveBeenCalled();
    expect(listMockCalendarEvents).not.toHaveBeenCalled();
  });

  it('does not expose production unauthenticated traffic to mock events', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect((await POST(confirm())).status).toBe(401);
    expect((await GET(new Request('http://localhost/api/calendar/upcoming'))).status).toBe(401);
    expect(createMockCalendarEvent).not.toHaveBeenCalled();
    expect(listMockCalendarEvents).not.toHaveBeenCalled();
  });

  it.each(['-1', '0', '1.5', '101', 'NaN', ''])('rejects an invalid upcoming count %s', async (count) => {
    expect((await GET(new Request(`http://localhost/api/calendar/upcoming?maxResults=${count}`))).status).toBe(400);
  });

  it('requires application/json Content-Type on confirm before parsing or reading session', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const req = new Request('https://calendai.tduong.online/api/calendar/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        Origin: 'https://other.tduong.online',
        'Sec-Fetch-Site': 'same-site',
      },
      body: JSON.stringify(proposal),
    });
    const response = await POST(req);
    expect(response.status).toBe(415);
    expect(getServerSession).not.toHaveBeenCalled();
    expect(getValidAccessToken).not.toHaveBeenCalled();
    expect(createMockCalendarEvent).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    const missingType = new Request('https://calendai.tduong.online/api/calendar/confirm', {
      method: 'POST',
      body: JSON.stringify(proposal),
    });
    expect((await POST(missingType)).status).toBe(415);
    expect(getServerSession).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([
    { Origin: 'https://attacker.example' },
    { Origin: 'https://other.tduong.online', 'Sec-Fetch-Site': 'same-site' },
    { 'Sec-Fetch-Site': 'same-site' },
    { Origin: 'null' },
    { Origin: '' },
    { 'Sec-Fetch-Site': 'cross-site' },
  ])('rejects cross-origin and cross-site confirm requests %j before reading session', async (extraHeaders) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const req = new Request('https://calendai.tduong.online/api/calendar/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(proposal),
    });
    const response = await POST(req);
    expect(response.status).toBe(403);
    expect(getServerSession).not.toHaveBeenCalled();
    expect(getValidAccessToken).not.toHaveBeenCalled();
    expect(createMockCalendarEvent).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows same-origin web and Origin-free Bearer confirm requests', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST'
      ? Response.json({ ...JSON.parse(String(init.body)), id: 'created' })
      : Response.json({}, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const sameOriginReq = new Request('https://calendai.tduong.online/api/calendar/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Origin: 'https://calendai.tduong.online',
        'Sec-Fetch-Site': 'same-origin',
      },
      body: JSON.stringify({ ...proposal, allowConflict: true }),
    });
    expect((await POST(sameOriginReq)).status).toBe(200);

    const mobileReq = new Request('https://calendai.tduong.online/api/calendar/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mobile-jwe',
      },
      body: JSON.stringify({ ...proposal, allowConflict: true }),
    });
    expect((await POST(mobileReq)).status).toBe(200);
  });
});
