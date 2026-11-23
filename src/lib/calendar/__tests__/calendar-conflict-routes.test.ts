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

  it('ignores valid zero-duration Google events in conflicts lookup and allows confirm', async () => {
    const zeroEvent = {
      id: 'zero-1', etag: '"z1"', summary: 'Mốc nhắc việc', status: 'confirmed',
      endTimeUnspecified: true,
      start: { dateTime: '2026-10-12T09:30:00+07:00' },
      end: { dateTime: '2026-10-12T09:30:00+07:00' },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(page([zeroEvent])));
    const conflictsRes = await conflicts(request(proposal));
    expect(conflictsRes.status).toBe(200);
    expect(await conflictsRes.json()).toEqual({ success: true, conflicts: [] });

    const confirmFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return Response.json({ ...JSON.parse(String(init.body)), id: 'created' });
      if (url.includes('?')) return page([zeroEvent]);
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal('fetch', confirmFetch);
    const confirmRes = await confirm(request(proposal));
    expect(confirmRes.status).toBe(200);
    expect(confirmFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true);
  });

  it('reports only real overlapping conflicts alongside zero-duration events on confirm', async () => {
    const zeroEvent = {
      id: 'zero-1', etag: '"z1"', summary: 'Mốc nhắc việc', status: 'confirmed',
      endTimeUnspecified: true,
      start: { dateTime: '2026-10-12T09:30:00+07:00' },
      end: { dateTime: '2026-10-12T09:30:00+07:00' },
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({}, { status: 404 }))
      .mockResolvedValueOnce(page([zeroEvent, busy])));
    const mixedRes = await confirm(request(proposal));
    expect(mixedRes.status).toBe(409);
    expect(await mixedRes.json()).toMatchObject({ success: false, code: 'CALENDAR_CONFLICT', conflicts: [{ id: busy.id }] });
  });

  it('allows rescheduling across a zero-duration event via resolve', async () => {
    const rescheduled = {
      ...busy, etag: '"v2"',
      start: { dateTime: '2026-10-12T11:00:00+07:00' },
      end: { dateTime: '2026-10-12T12:00:00+07:00' },
    };
    const zeroInNewSlot = {
      id: 'zero-2', etag: '"z2"', summary: 'Deadline', status: 'confirmed',
      endTimeUnspecified: true,
      start: { dateTime: '2026-10-12T11:30:00+07:00' },
      end: { dateTime: '2026-10-12T11:30:00+07:00' },
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json(busy))
      .mockResolvedValueOnce(page([zeroInNewSlot]))
      .mockResolvedValueOnce(Response.json(rescheduled)));
    const resolveRes = await resolve(request({
      ...mutation, action: 'reschedule',
      startDateTime: '2026-10-12T11:00:00+07:00', endDateTime: '2026-10-12T12:00:00+07:00',
    }));
    expect(resolveRes.status).toBe(200);
    expect(await resolveRes.json()).toEqual({ success: true });
  });

  it.each([
    {},
    { timeZone: 'Asia/Ho_Chi_Minh', items: [{ ...busy, etag: undefined }] },
    { timeZone: 'Asia/Ho_Chi_Minh', items: [{ ...busy, start: { dateTime: '2026-10-12T09:30:00+07:00' }, end: { dateTime: '2026-10-12T09:00:00+07:00' } }] },
    { timeZone: 'Asia/Ho_Chi_Minh', items: [{ ...busy, start: { date: '2026-10-12' }, end: { date: '2026-10-12' } }] },
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

  it('returns 401 SESSION_REFRESH_REQUIRED for Bearer mobile when Google Calendar returns 401 on conflicts or resolve', async () => {
    const mobileSession = {
      ...session,
      kind: 'mobile' as const,
      expiresAt: Date.now() + 86_400_000,
      tokens: { ...session.tokens, refreshToken: 'refresh' },
    };
    vi.mocked(getServerSession).mockResolvedValue(mobileSession);
    const unauthorized = () => Response.json({ error: { code: 401, message: 'Invalid Credentials' } }, { status: 401 });

    // 1. /api/calendar/conflicts 401
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(unauthorized()));
    const conflictsRes = await conflicts(request(proposal, { Authorization: 'Bearer mobile-jwe' }));
    expect(conflictsRes.status).toBe(401);
    expect(conflictsRes.headers.get('Cache-Control')).toBe('no-store');
    expect(conflictsRes.headers.get('WWW-Authenticate')).toBe('Bearer');
    const conflictsBody = await conflictsRes.json();
    expect(conflictsBody).toMatchObject({ success: false, code: 'SESSION_REFRESH_REQUIRED' });
    expect(JSON.stringify(conflictsBody)).not.toContain('Invalid Credentials');

    // 2. /api/calendar/resolve 401 on initial GET
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(unauthorized()));
    const resolveGetRes = await resolve(request(mutation, { Authorization: 'Bearer mobile-jwe' }));
    expect(resolveGetRes.status).toBe(401);
    expect(resolveGetRes.headers.get('Cache-Control')).toBe('no-store');
    expect(resolveGetRes.headers.get('WWW-Authenticate')).toBe('Bearer');
    const resolveGetBody = await resolveGetRes.json();
    expect(resolveGetBody).toMatchObject({ success: false, code: 'SESSION_REFRESH_REQUIRED' });
    expect(JSON.stringify(resolveGetBody)).not.toContain('Invalid Credentials');

    // 3. /api/calendar/resolve 401 on DELETE/PATCH mutation
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(busy)).mockResolvedValueOnce(unauthorized()));
    const resolveMutationRes = await resolve(request(mutation, { Authorization: 'Bearer mobile-jwe' }));
    expect(resolveMutationRes.status).toBe(401);
    expect(await resolveMutationRes.json()).toMatchObject({ success: false, code: 'SESSION_REFRESH_REQUIRED' });
  });

  it('returns 401 google_reauthorization_required or refreshes once for web cookies when Google Calendar returns 401', async () => {
    const unauthorized = () => Response.json({ error: { code: 401, message: 'Invalid Credentials' } }, { status: 401 });

    for (const route of [conflicts, resolve]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(unauthorized()));
      const res = await route(request(route === conflicts ? proposal : mutation));
      expect(res.status).toBe(401);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(res.headers.get('WWW-Authenticate')).toBe('Bearer');
      const body = await res.json();
      expect(body).toMatchObject({ success: false, code: 'google_reauthorization_required' });
      expect(typeof body.error).toBe('string');
      expect(JSON.stringify(body)).not.toContain('Invalid Credentials');
    }

    // Web refresh succeeds and retries resolve once
    vi.mocked(getValidAccessToken)
      .mockResolvedValueOnce({ accessToken: 'stale-access' })
      .mockResolvedValueOnce({ accessToken: 'fresh-access' });
    const retryFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const authHeader = new Headers(init?.headers).get('Authorization');
      if (authHeader === 'Bearer stale-access') return unauthorized();
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return Response.json(busy);
    });
    vi.stubGlobal('fetch', retryFetch);
    const req = request(mutation);
    const refreshedRes = await resolve(req);
    expect(refreshedRes.status).toBe(200);
    expect(getValidAccessToken).toHaveBeenNthCalledWith(1, session, req);
    expect(getValidAccessToken).toHaveBeenNthCalledWith(2, session, req, { forceRefresh: true });
    expect(await refreshedRes.json()).toEqual({ success: true });
  });

  it.each([
    { 'Content-Type': 'text/plain', Origin: 'https://other.tduong.online', 'Sec-Fetch-Site': 'same-site' },
    { 'Content-Type': 'text/plain; charset=utf-8' },
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    {},
  ] as Record<string, string>[])('requires application/json Content-Type on conflicts before reading session %j', async (headers) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const req = new Request('https://calendai.tduong.online/api/calendar/conflicts', {
      method: 'POST',
      headers,
      body: JSON.stringify(proposal),
    });
    const response = await conflicts(req);
    expect(response.status).toBe(415);
    const body = await response.json() as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe('string');
    expect(body.error?.length).toBeGreaterThan(0);
    expect(getServerSession).not.toHaveBeenCalled();
    expect(getValidAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([
    { Origin: 'https://attacker.example' },
    { Origin: 'https://other.tduong.online', 'Sec-Fetch-Site': 'same-site' },
    { 'Sec-Fetch-Site': 'same-site' },
    { Origin: 'null' },
    { Origin: '' },
    { 'Sec-Fetch-Site': 'cross-site' },
    { Authorization: 'Bearer mobile-jwe', 'Sec-Fetch-Site': 'cross-site' },
  ])('rejects cross-origin and same-site conflicts requests %j with 403 no-store before reading session', async (extraHeaders) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const req = new Request('https://calendai.tduong.online/api/calendar/conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(proposal),
    });
    const response = await conflicts(req);
    expect(response.status).toBe(403);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json() as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe('string');
    expect(body.error?.length).toBeGreaterThan(0);
    expect(getServerSession).not.toHaveBeenCalled();
    expect(getValidAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows same-origin web and Origin-free Bearer conflicts requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => page([busy])));

    const webReq = new Request('https://calendai.tduong.online/api/calendar/conflicts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Origin: 'https://calendai.tduong.online',
        'Sec-Fetch-Site': 'same-origin',
      },
      body: JSON.stringify(proposal),
    });
    const webRes = await conflicts(webReq);
    expect(webRes.status).toBe(200);
    expect(await webRes.json()).toMatchObject({ success: true, conflicts: [{ id: busy.id }] });

    const mobileReq = new Request('https://calendai.tduong.online/api/calendar/conflicts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mobile-jwe',
      },
      body: JSON.stringify(proposal),
    });
    const mobileRes = await conflicts(mobileReq);
    expect(mobileRes.status).toBe(200);
    expect(await mobileRes.json()).toMatchObject({ success: true, conflicts: [{ id: busy.id }] });
  });
});
