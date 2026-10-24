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
  it('passes Request to shared auth and reconciles actual stable inserts, returning 409 for changed payload', async () => {
    let stored: Record<string, unknown> | undefined;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
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
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => Response.json({ ...JSON.parse(String(init?.body)), id: 'legacy-created' }));
    vi.stubGlobal('fetch', fetchMock);
    const { proposalId: _ignored, ...legacy } = proposal;
    const response = await POST(confirm(legacy));
    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).id).toBeUndefined();
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
});
