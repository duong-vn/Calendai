// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as confirm } from '@/app/api/calendar/confirm/route';
import { POST as conflicts } from '@/app/api/calendar/conflicts/route';
import { POST as resolve } from '@/app/api/calendar/resolve/route';
import { authErrorResponse, getServerSession, getValidAccessToken } from '@/lib/auth/server-session';
import { calendarProposalEventId } from '../google-calendar-service';

vi.mock('@/lib/auth/server-session', () => ({ getServerSession: vi.fn(), getValidAccessToken: vi.fn(), authErrorResponse: vi.fn() }));
vi.mock('@/lib/env', () => ({ isGoogleConfigured: () => false }));

const session = {
  user: { id: 'google-account', email: 'person@example.com', name: 'Người dùng' },
  tokens: { accessToken: 'access', expiresAt: Date.now() + 3600000, tokenType: 'Bearer' as const, scope: 'calendar' }, createdAt: Date.now(),
};
const proposal = {
  proposalId: 'proposal-1', summary: 'Họp dự án', createMeet: false,
  startDateTime: '2026-10-12T09:00:00+07:00', endDateTime: '2026-10-12T10:00:00+07:00',
};
const busy = {
  id: 'busy', etag: '"v1"', summary: 'Lịch bận', status: 'confirmed',
  start: { dateTime: proposal.startDateTime }, end: { dateTime: proposal.endDateTime },
};
const mutation = { proposal, eventId: busy.id, etag: busy.etag, action: 'cancel' };
const request = (body: unknown, headers?: Record<string, string>) => new Request('http://localhost/api/calendar/action', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const page = (items: unknown[]) => Response.json({ timeZone: 'Asia/Ho_Chi_Minh', items });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected Google Calendar request')));
  vi.mocked(getServerSession).mockResolvedValue(session);
  vi.mocked(getValidAccessToken).mockResolvedValue({ accessToken: 'access' });
  vi.mocked(authErrorResponse).mockReturnValue(null);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Calendar conflict HTTP contracts', () => {
  it('checks authenticated primary calendar and returns only conflict fields', async () => {
    const ownId = calendarProposalEventId(session.user.id, proposal.proposalId);
    const fetchMock = vi.fn().mockResolvedValue(page([{ ...busy, privateDiagnostic: 'private' }, { ...busy, id: ownId }]));
    vi.stubGlobal('fetch', fetchMock);
    const req = request(proposal);
    const response = await conflicts(req);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, conflicts: [{
      id: busy.id, etag: busy.etag, summary: busy.summary, start: proposal.startDateTime, end: proposal.endDateTime, timeZone: 'Asia/Ho_Chi_Minh', isAllDay: false,
    }] });
    expect(getServerSession).toHaveBeenCalledWith(req);
    expect(getValidAccessToken).toHaveBeenCalledWith(session, req);
  });

  it('guards confirm before insert and returns overlaps as 409', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 404 })).mockResolvedValueOnce(page([busy]));
    vi.stubGlobal('fetch', fetchMock);
    const response = await confirm(request(proposal));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, code: 'CALENDAR_CONFLICT', conflicts: [{ id: busy.id }] });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('guards legacy confirmation without a proposal ID too', async () => {
    const fetchMock = vi.fn().mockResolvedValue(page([busy]));
    vi.stubGlobal('fetch', fetchMock);
    const { proposalId: _ignored, ...legacy } = proposal;
    expect((await confirm(request(legacy))).status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, false])('does not bypass conflicts with allowConflict=%s', async (allowConflict) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({}, { status: 404 })).mockResolvedValueOnce(page([busy])));
    expect((await confirm(request({ ...proposal, allowConflict }))).status).toBe(409);
  });

  it.each(['true', 1, null])('rejects non-boolean allowConflict=%s', async (allowConflict) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await confirm(request({ ...proposal, allowConflict }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows an explicitly confirmed overlap, still checking proposal identity', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST'
      ? Response.json(JSON.parse(String(init.body))) : Response.json({}, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await confirm(request({ ...proposal, allowConflict: true }))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.method).toBe('POST');
    expect(fetchMock.mock.calls[0][0]).not.toContain('?');
  });

  it('reconciles existing retries before conflict lookup, including changed payload', async () => {
    let stored: Record<string, unknown> | undefined;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        stored = JSON.parse(String(init.body));
        return Response.json(stored);
      }
      if (url.includes('?')) return page(stored ? [busy] : []);
      return stored ? Response.json(stored) : Response.json({}, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    expect((await confirm(request(proposal))).status).toBe(200);
    expect((await confirm(request(proposal))).status).toBe(200);
    const changed = await confirm(request({ ...proposal, summary: 'Đổi nội dung' }));
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({ code: 'PROPOSAL_CONFLICT' });
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('?') && !url.includes('conferenceDataVersion'))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it.each([
    {},
    { timeZone: 'Asia/Ho_Chi_Minh', items: [{ ...busy, etag: undefined }] },
    { timeZone: 'Asia/Ho_Chi_Minh', items: [], error: { message: 'private diagnostic' } },
  ])('fails closed without insertion on malformed conflict lookup %j', async (data) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 404 })).mockResolvedValueOnce(Response.json(data));
    vi.stubGlobal('fetch', fetchMock);
    const response = await confirm(request(proposal));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private diagnostic');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it.each([conflicts, resolve])('does not expose provider diagnostics from new routes', async (route) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { message: 'private diagnostic access-key' } }, { status: 403 })));
    const response = await route(request(route === conflicts ? proposal : mutation));
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain('private diagnostic');
    expect(text).not.toContain('access-key');
  });

  it('authenticates resolve and returns only success after the conditional mutation', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(busy)).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const req = request(mutation);
    const response = await resolve(req);
    expect(await response.json()).toEqual({ success: true });
    expect(getServerSession).toHaveBeenCalledWith(req);
    expect(getValidAccessToken).toHaveBeenCalledWith(session, req);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE', headers: { 'If-Match': busy.etag } });
  });

  it('maps conditional mutation race to 409 STALE_EVENT', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(busy)).mockResolvedValueOnce(Response.json({}, { status: 412 })));
    const response = await resolve(request(mutation));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, code: 'STALE_EVENT' });
  });

  it('returns 409 CALENDAR_CONFLICT for rescheduling into the pending proposal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(busy)));
    const response = await resolve(request({ ...mutation, action: 'reschedule', startDateTime: proposal.startDateTime, endDateTime: proposal.endDateTime }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, code: 'CALENDAR_CONFLICT' });
  });

  it.each([
    { action: 'unknown' }, { etag: '*' }, { eventId: '../bad' },
    { action: 'reschedule' }, { action: 'reschedule', startDateTime: '2026-10-12T11:00:00', endDateTime: '2026-10-12T12:00:00+07:00' },
  ])('rejects invalid resolve input before provider calls %j', async (change) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await resolve(request({ ...mutation, ...change }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([
    { Origin: 'https://attacker.example' }, { 'Sec-Fetch-Site': 'cross-site' },
  ])('rejects cross-origin destructive cookie requests %j', async (headers) => {
    expect((await resolve(request(mutation, headers))).status).toBe(403);
    expect(getServerSession).not.toHaveBeenCalled();
  });

  it('requires JSON for destructive requests', async () => {
    expect((await resolve(request(mutation, { 'Content-Type': 'text/plain' }))).status).toBe(415);
    expect(getServerSession).not.toHaveBeenCalled();
  });

  it.each([conflicts, resolve])('requires auth and never uses mock for native Bearer requests', async (route) => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.mocked(getServerSession).mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await route(request(route === conflicts ? proposal : mutation, { Authorization: 'Bearer invalid' }))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([conflicts, resolve])('preserves shared auth failures', async (route) => {
    const error = new Error('auth');
    vi.mocked(getValidAccessToken).mockRejectedValueOnce(error);
    vi.mocked(authErrorResponse).mockReturnValueOnce(Response.json({ code: 'AUTH_INVALID' }, { status: 401 }));
    expect((await route(request(route === conflicts ? proposal : mutation))).status).toBe(401);
    expect(authErrorResponse).toHaveBeenCalledWith(error);
  });

  it('preserves local conflicts mock but never mocks resolve or production conflicts', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect(await (await conflicts(request(proposal))).json()).toMatchObject({ success: true, conflicts: [], mode: 'mock' });
    expect((await resolve(request(mutation))).status).toBe(401);
    vi.stubEnv('NODE_ENV', 'production');
    expect((await conflicts(request(proposal))).status).toBe(401);
  });
});
