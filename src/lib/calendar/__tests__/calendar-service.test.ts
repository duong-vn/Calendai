import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CalendarPermissionError,
  CalendarUnauthorizedError,
  createGoogleCalendarEvent,
  listGoogleCalendarEvents,
} from '../google-calendar-service';
import {
  createMockCalendarEvent,
  listMockCalendarEvents,
} from '../mock-calendar-service';

describe('Google Calendar Service Layer', () => {
  it.each([{ reminderMinutes: [30, 5] }, { reminderMinutes: [] }])('sends configured popup reminders %j', async ({ reminderMinutes }) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'new' }) });
    vi.stubGlobal('fetch', fetchMock);
    await createGoogleCalendarEvent('access', { summary: 'Họp', startDateTime: '2026-11-02T09:00:00+07:00', endDateTime: '2026-11-02T10:00:00+07:00', reminderMinutes });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reminders).toEqual({ useDefault: false, overrides: reminderMinutes.map(minutes => ({ method: 'popup', minutes })) });
  });
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates Google Calendar event with Google Meet successfully', async () => {
    const mockApiResponse = {
      id: 'google-event-id-999',
      summary: 'Họp Kế hoạch Tuần',
      description: 'Nội dung chi tiết',
      status: 'confirmed',
      htmlLink: 'https://calendar.google.com/event?id=999',
      hangoutLink: 'https://meet.google.com/abc-defg-hij',
      start: {
        dateTime: '2026-10-12T09:00:00+07:00',
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      end: {
        dateTime: '2026-10-12T10:00:00+07:00',
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      attendees: [{ email: 'partner@example.com' }],
      conferenceData: {
        createRequest: {
          requestId: 'test-uuid',
          status: { statusCode: 'success' },
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await createGoogleCalendarEvent('mock-access-token', {
      summary: 'Họp Kế hoạch Tuần',
      description: 'Nội dung chi tiết',
      startDateTime: '2026-10-12T09:00:00+07:00',
      endDateTime: '2026-10-12T10:00:00+07:00',
      timeZone: 'Asia/Ho_Chi_Minh',
      attendees: [{ email: 'partner@example.com' }],
      createMeet: true,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    const calledOptions = mockFetch.mock.calls[0][1];

    expect(calledUrl).toContain('conferenceDataVersion=1');
    expect(new URL(calledUrl).searchParams.get('sendUpdates')).toBe('all');
    expect(calledOptions.headers.Authorization).toBe('Bearer mock-access-token');

    const parsedBody = JSON.parse(calledOptions.body);
    expect(parsedBody.summary).toBe('Họp Kế hoạch Tuần');
    expect(parsedBody.reminders).toEqual({ useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'popup', minutes: 10 }] });
    expect(parsedBody.conferenceData?.createRequest?.conferenceSolutionKey?.type).toBe('hangoutsMeet');

    expect(result.id).toBe('google-event-id-999');
    expect(result.hangoutLink).toBe('https://meet.google.com/abc-defg-hij');
    expect(result.conferenceStatus).toBe('success');
  });

  it.each([undefined, []])('omits invitation updates when attendees are %j', async (attendees) => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'event-without-guests' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await createGoogleCalendarEvent('mock-access-token', {
      summary: 'Lịch cá nhân',
      startDateTime: '2026-10-12T09:00:00+07:00',
      endDateTime: '2026-10-12T10:00:00+07:00',
      attendees,
    });

    expect(new URL(mockFetch.mock.calls[0][0]).searchParams.has('sendUpdates')).toBe(false);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).attendees).toBeUndefined();
  });

  it('falls back to entryPoints video uri when top-level hangoutLink is absent', async () => {
    const mockApiResponse = {
      id: 'google-event-id-888',
      summary: 'Họp Khẩn',
      htmlLink: 'https://calendar.google.com/event?id=888',
      start: { dateTime: '2026-10-12T09:00:00+07:00' },
      end: { dateTime: '2026-10-12T10:00:00+07:00' },
      conferenceData: {
        entryPoints: [
          { entryPointType: 'video', uri: 'https://meet.google.com/fallback-meet-uri' },
        ],
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }));

    const result = await createGoogleCalendarEvent('mock-token', {
      summary: 'Họp Khẩn',
      startDateTime: '2026-10-12T09:00:00+07:00',
      endDateTime: '2026-10-12T10:00:00+07:00',
    });

    expect(result.hangoutLink).toBe('https://meet.google.com/fallback-meet-uri');
  });

  it('strips untrusted hangoutLink/video entryPoints and normalizes untrusted htmlLink across create and list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'evt-phish-create',
            summary: 'Lời mời bên ngoài',
            htmlLink: 'http://evil.example/cal',
            hangoutLink: 'https://user:pass@meet.google.com/abc-defg-hij',
            start: { dateTime: '2026-10-12T09:00:00+07:00' },
            end: { dateTime: '2026-10-12T10:00:00+07:00' },
            conferenceData: {
              entryPoints: [
                { entryPointType: 'video', uri: 'https://meet.google.com.evil.test/phish' },
              ],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'evt-phish-list',
                summary: 'Cuộc họp giả mạo',
                start: { dateTime: '2026-10-12T14:00:00+07:00' },
                end: { dateTime: '2026-10-12T15:00:00+07:00' },
                htmlLink: 'https://calendar.google.com.evil.test/event?id=1',
                conferenceData: {
                  entryPoints: [
                    { entryPointType: 'video', uri: 'https://meet.google.com.evil.test/phish' },
                  ],
                },
              },
              {
                id: 'evt-mixed-entrypoints',
                summary: 'Cuộc họp có link phụ hợp lệ',
                start: { dateTime: '2026-10-12T16:00:00+07:00' },
                end: { dateTime: '2026-10-12T17:00:00+07:00' },
                htmlLink: 'https://www.google.com/calendar/event?eid=valid-www',
                hangoutLink: 'http://meet.google.com/insecure-room',
                conferenceData: {
                  entryPoints: [
                    { entryPointType: 'video', uri: 'https://thirdparty.example/room' },
                    { entryPointType: 'video', uri: 'https://meet.google.com/real-meet-room' },
                  ],
                },
              },
            ],
          }),
        })
    );

    const created = await createGoogleCalendarEvent('mock-token', {
      summary: 'Lời mời bên ngoài',
      startDateTime: '2026-10-12T09:00:00+07:00',
      endDateTime: '2026-10-12T10:00:00+07:00',
    });
    expect(created.hangoutLink).toBeUndefined();
    expect(created.conferenceStatus).toBeUndefined();
    expect(created.htmlLink).toBe('https://www.google.com/calendar/event?eid=evt-phish-create');

    const listed = await listGoogleCalendarEvents('mock-token', { maxResults: 5 });
    expect(listed).toHaveLength(2);
    expect(listed[0].hangoutLink).toBeUndefined();
    expect(listed[0].htmlLink).toBe('https://www.google.com/calendar/event?eid=evt-phish-list');
    expect(listed[1].hangoutLink).toBe('https://meet.google.com/real-meet-room');
    expect(listed[1].htmlLink).toBe('https://www.google.com/calendar/event?eid=valid-www');
  });

  it('throws descriptive error when Google API fails with non-401 status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({
        error: { message: 'Insufficient Permission', code: 403 },
      }),
    }));

    await expect(
      createGoogleCalendarEvent('expired-token', {
        summary: 'Test',
        startDateTime: '2026-10-12T09:00:00+07:00',
        endDateTime: '2026-10-12T10:00:00+07:00',
      })
    ).rejects.toThrow('Google Calendar API Error (403): Insufficient Permission');
  });

  it('throws CalendarUnauthorizedError without leaking Google details on HTTP 401 pre-checks, inserts, and listings', async () => {
    const unauthorized = () => Response.json({ error: { message: 'Invalid Credentials', code: 401 } }, { status: 401 });

    // 1. Pre-insert idempotency check 401 must abort before beforeInsert or POST
    const precheckFetch = vi.fn().mockResolvedValueOnce(unauthorized());
    const beforeInsert = vi.fn();
    vi.stubGlobal('fetch', precheckFetch);
    await expect(
      createGoogleCalendarEvent(
        'expired-token',
        {
          summary: 'Test',
          startDateTime: '2026-10-12T09:00:00+07:00',
          endDateTime: '2026-10-12T10:00:00+07:00',
        },
        { accountId: 'acc-1', proposalId: 'prop-1' },
        beforeInsert
      )
    ).rejects.toBeInstanceOf(CalendarUnauthorizedError);
    expect(beforeInsert).not.toHaveBeenCalled();
    expect(precheckFetch).toHaveBeenCalledTimes(1);

    // 2. Direct POST 401 must throw CalendarUnauthorizedError (even with non-JSON 401 body) without reconcile or leaking text
    const postFetch = vi.fn().mockResolvedValueOnce(new Response('Invalid Credentials secret', { status: 401, statusText: 'Unauthorized' }));
    vi.stubGlobal('fetch', postFetch);
    const postErr = await createGoogleCalendarEvent(
      'expired-token',
      {
        summary: 'Test',
        startDateTime: '2026-10-12T09:00:00+07:00',
        endDateTime: '2026-10-12T10:00:00+07:00',
      },
      { accountId: 'acc-1', proposalId: 'prop-1' }
    ).catch((e: unknown) => e);
    expect(postErr).toBeInstanceOf(CalendarUnauthorizedError);
    expect((postErr as Error).message).not.toContain('Invalid Credentials');
    expect(postFetch).toHaveBeenCalledTimes(1);

    // 3. Uncertain POST 500 followed by 401 during reconcile keeps the uncertain error (never emits CalendarUnauthorizedError)
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(Response.json({ error: { message: 'Backend down' } }, { status: 500 }))
        .mockResolvedValueOnce(unauthorized())
    );
    const uncertainErr = await createGoogleCalendarEvent(
      'expired-token',
      {
        summary: 'Test',
        startDateTime: '2026-10-12T09:00:00+07:00',
        endDateTime: '2026-10-12T10:00:00+07:00',
      },
      { accountId: 'acc-1', proposalId: 'prop-1' }
    ).catch((e: unknown) => e);
    expect(uncertainErr).not.toBeInstanceOf(CalendarUnauthorizedError);
    expect((uncertainErr as Error).message).toContain('500');

    // 4. listGoogleCalendarEvents 401 on page 1 and page 2
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(unauthorized()));
    await expect(listGoogleCalendarEvents('expired-token')).rejects.toBeInstanceOf(CalendarUnauthorizedError);

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'page-2' }))
        .mockResolvedValueOnce(unauthorized())
    );
    await expect(listGoogleCalendarEvents('expired-token')).rejects.toBeInstanceOf(CalendarUnauthorizedError);
  });

  it('distinguishes HTTP 403 insufficientPermissions/authError from 403 rateLimitExceeded across create and list', async () => {
    const permission403 = (reason = 'insufficientPermissions') => Response.json({
      error: {
        code: 403,
        message: 'Insufficient Permission secret detail',
        errors: [{ domain: 'global', reason, message: 'Insufficient Permission' }],
      },
    }, { status: 403 });
    const detailsScope403 = () => Response.json({
      error: {
        code: 403,
        message: 'Request had insufficient authentication scopes.',
        status: 'PERMISSION_DENIED',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }],
      },
    }, { status: 403 });
    const rateLimit403 = (reason: 'rateLimitExceeded' | 'userRateLimitExceeded') => Response.json({
      error: {
        code: 403,
        message: 'Rate Limit Exceeded',
        errors: [{ domain: 'usageLimits', reason, message: 'Rate Limit Exceeded' }],
      },
    }, { status: 403 });

    // 1. Pre-insert check 403 insufficientPermissions aborts before beforeInsert and POST
    const precheckFetch = vi.fn().mockResolvedValueOnce(permission403());
    const beforeInsert = vi.fn();
    vi.stubGlobal('fetch', precheckFetch);
    await expect(
      createGoogleCalendarEvent(
        'narrow-token',
        { summary: 'Test', startDateTime: '2026-10-12T09:00:00+07:00', endDateTime: '2026-10-12T10:00:00+07:00' },
        { accountId: 'acc-1', proposalId: 'prop-1' },
        beforeInsert
      )
    ).rejects.toMatchObject({
      name: 'CalendarPermissionError',
      code: 'google_calendar_permission_required',
      status: 403,
    });
    expect(beforeInsert).not.toHaveBeenCalled();
    expect(precheckFetch).toHaveBeenCalledTimes(1);

    // 2. Direct POST 403 insufficientPermissions / ACCESS_TOKEN_SCOPE_INSUFFICIENT throws CalendarPermissionError without reconcile
    for (const makeRes of [() => permission403('authError'), detailsScope403]) {
      const postFetch = vi.fn().mockResolvedValueOnce(makeRes());
      vi.stubGlobal('fetch', postFetch);
      const err = await createGoogleCalendarEvent(
        'narrow-token',
        { summary: 'Test', startDateTime: '2026-10-12T09:00:00+07:00', endDateTime: '2026-10-12T10:00:00+07:00' },
        { accountId: 'acc-1', proposalId: 'prop-1' }
      ).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(CalendarPermissionError);
      expect(err).toMatchObject({
        name: 'CalendarPermissionError',
        code: 'google_calendar_permission_required',
        status: 403,
      });
      expect((err as Error).message).not.toContain('secret detail');
      expect(postFetch).toHaveBeenCalledTimes(1);
    }

    // 3. Uncertain POST 500 followed by 403 insufficientPermissions during reconcile keeps uncertain 500 error
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(Response.json({ error: { message: 'Backend down' } }, { status: 500 }))
        .mockResolvedValueOnce(permission403())
    );
    const uncertainErr = await createGoogleCalendarEvent(
      'narrow-token',
      { summary: 'Test', startDateTime: '2026-10-12T09:00:00+07:00', endDateTime: '2026-10-12T10:00:00+07:00' },
      { accountId: 'acc-1', proposalId: 'prop-1' }
    ).catch((e: unknown) => e);
    expect((uncertainErr as Error).name).not.toBe('CalendarPermissionError');
    expect((uncertainErr as Error).message).toContain('500');

    // 4. listGoogleCalendarEvents 403 insufficientPermissions throws CalendarPermissionError, rateLimitExceeded does not
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(permission403()));
    await expect(listGoogleCalendarEvents('narrow-token')).rejects.toMatchObject({
      name: 'CalendarPermissionError',
      code: 'google_calendar_permission_required',
      status: 403,
    });

    for (const reason of ['rateLimitExceeded', 'userRateLimitExceeded'] as const) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(rateLimit403(reason)));
      const listRateErr = await listGoogleCalendarEvents('valid-token').catch((e: unknown) => e);
      expect((listRateErr as Error).name).not.toBe('CalendarPermissionError');

      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(rateLimit403(reason)));
      const createRateErr = await createGoogleCalendarEvent(
        'valid-token',
        { summary: 'Test', startDateTime: '2026-10-12T09:00:00+07:00', endDateTime: '2026-10-12T10:00:00+07:00' }
      ).catch((e: unknown) => e);
      expect((createRateErr as Error).name).not.toBe('CalendarPermissionError');
    }
  });

  it('lists upcoming events accurately', async () => {
    const mockApiResponse = {
      items: [
        {
          id: 'event-1',
          summary: 'Review Code',
          start: { dateTime: '2026-10-12T14:00:00+07:00' },
          end: { dateTime: '2026-10-12T15:00:00+07:00' },
          hangoutLink: 'https://meet.google.com/xyz-test-meet',
          htmlLink: 'https://calendar.google.com/event?id=event-1',
        },
      ],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }));

    const events = await listGoogleCalendarEvents('valid-token', { maxResults: 5 });
    expect(events.length).toBe(1);
    expect(events[0].summary).toBe('Review Code');
    expect(events[0].hangoutLink).toBe('https://meet.google.com/xyz-test-meet');
    expect(events[0].isAllDay).toBe(false);
  });

  it('normalizes omitted end to start for zero-duration Google Calendar events while keeping normal events intact', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'zero-omitted-end',
            summary: 'Nhắc nộp báo cáo',
            endTimeUnspecified: true,
            start: { dateTime: '2026-11-24T09:45:00+07:00' },
          },
          {
            id: 'zero-empty-end-obj',
            summary: 'Mốc kiểm tra',
            start: { dateTime: '2026-11-24T11:00:00+07:00' },
            end: {},
          },
          {
            id: 'normal-meeting',
            summary: 'Họp nhóm',
            start: { dateTime: '2026-11-24T14:00:00+07:00' },
            end: { dateTime: '2026-11-24T15:00:00+07:00' },
          },
          {
            id: 'missing-start',
            summary: 'Dữ liệu lỗi',
          },
        ],
      }),
    }));

    const events = await listGoogleCalendarEvents('valid-token', { maxResults: 10 });
    expect(events).toHaveLength(4);
    expect(events[0]).toMatchObject({
      id: 'zero-omitted-end',
      summary: 'Nhắc nộp báo cáo',
      start: '2026-11-24T09:45:00+07:00',
      end: '2026-11-24T09:45:00+07:00',
      isAllDay: false,
    });
    expect(events[1]).toMatchObject({
      id: 'zero-empty-end-obj',
      start: '2026-11-24T11:00:00+07:00',
      end: '2026-11-24T11:00:00+07:00',
      isAllDay: false,
    });
    expect(events[2]).toMatchObject({
      id: 'normal-meeting',
      start: '2026-11-24T14:00:00+07:00',
      end: '2026-11-24T15:00:00+07:00',
      isAllDay: false,
    });
    expect(events[3]).toMatchObject({
      id: 'missing-start',
      start: '',
      end: '',
    });
  });

  it('continues across empty and short pages until maxResults matching events are collected', async () => {
    const mockFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'page-2' }))
      .mockResolvedValueOnce(Response.json({
        items: [
          { id: 'evt-1', summary: 'First', start: { dateTime: '2026-10-12T09:00:00+07:00' }, end: { dateTime: '2026-10-12T10:00:00+07:00' } },
        ],
        nextPageToken: 'page-3',
      }))
      .mockResolvedValueOnce(Response.json({
        items: [
          { id: 'evt-2', summary: 'Second', start: { dateTime: '2026-10-12T11:00:00+07:00' }, end: { dateTime: '2026-10-12T12:00:00+07:00' } },
          { id: 'evt-3', summary: 'Third', start: { dateTime: '2026-10-12T13:00:00+07:00' }, end: { dateTime: '2026-10-12T14:00:00+07:00' } },
          { id: 'evt-4', summary: 'Fourth', start: { dateTime: '2026-10-12T15:00:00+07:00' }, end: { dateTime: '2026-10-12T16:00:00+07:00' } },
        ],
        nextPageToken: 'page-4',
      }));
    vi.stubGlobal('fetch', mockFetch);

    const events = await listGoogleCalendarEvents('valid-token', { maxResults: 3 });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(new URL(mockFetch.mock.calls[1][0]).searchParams.get('pageToken')).toBe('page-2');
    expect(new URL(mockFetch.mock.calls[2][0]).searchParams.get('pageToken')).toBe('page-3');
    expect(events.map((event) => event.id)).toEqual(['evt-1', 'evt-2', 'evt-3']);
  });

  it('stops paginating as soon as maxResults events are satisfied on the first page', async () => {
    const mockFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({
        items: [
          { id: 'evt-1', start: { dateTime: '2026-10-12T09:00:00+07:00' }, end: { dateTime: '2026-10-12T10:00:00+07:00' } },
          { id: 'evt-2', start: { dateTime: '2026-10-12T11:00:00+07:00' }, end: { dateTime: '2026-10-12T12:00:00+07:00' } },
        ],
        nextPageToken: 'page-2',
      }));
    vi.stubGlobal('fetch', mockFetch);

    const events = await listGoogleCalendarEvents('valid-token', { maxResults: 2 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(events.map((event) => event.id)).toEqual(['evt-1', 'evt-2']);
  });

  it('fails closed when a subsequent page fails or repeats a page token', async () => {
    const errorFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'page-2' }))
      .mockResolvedValueOnce(Response.json({ error: { message: 'Upstream error' } }, { status: 500 }));
    vi.stubGlobal('fetch', errorFetch);

    await expect(listGoogleCalendarEvents('valid-token', { maxResults: 5 })).rejects.toThrow('Google Calendar API Error (500): Upstream error');

    const repeatedFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'same-token' }))
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'same-token' }));
    vi.stubGlobal('fetch', repeatedFetch);

    await expect(listGoogleCalendarEvents('valid-token', { maxResults: 5 })).rejects.toThrow('repeated page');
  });

  it('handles omitted items arrays on empty pages and rejects non-JSON next-page errors', async () => {
    const omittedItemsFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ nextPageToken: 'page-2' }))
      .mockResolvedValueOnce(Response.json({
        items: [{ id: 'evt-ok', start: { dateTime: '2026-10-12T09:00:00+07:00' }, end: { dateTime: '2026-10-12T10:00:00+07:00' } }],
      }));
    vi.stubGlobal('fetch', omittedItemsFetch);

    const events = await listGoogleCalendarEvents('valid-token', { maxResults: 3 });
    expect(events.map((event) => event.id)).toEqual(['evt-ok']);

    const badGatewayFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'page-2' }))
      .mockResolvedValueOnce(new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' }));
    vi.stubGlobal('fetch', badGatewayFetch);

    await expect(listGoogleCalendarEvents('valid-token', { maxResults: 3 })).rejects.toThrow('Google Calendar API Error (502): Bad Gateway');
  });
});

describe('Mock Calendar Service', () => {
  it('creates mock events with valid meet links and attributes', async () => {
    const mockEvent = await createMockCalendarEvent({
      summary: 'Mock Meeting Demo',
      startDateTime: '2026-10-15T10:00:00+07:00',
      endDateTime: '2026-10-15T11:00:00+07:00',
      attendees: [{ email: 'demo@example.com' }],
      createMeet: true,
    });

    expect(mockEvent.id).toContain('mock-event-');
    expect(mockEvent.summary).toBe('Mock Meeting Demo');
    expect(mockEvent.hangoutLink).toMatch(/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
    expect(mockEvent.conferenceStatus).toBe('success');
  });

  it('lists mock events correctly', async () => {
    const list = await listMockCalendarEvents();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].summary).toBeDefined();
  });
});
