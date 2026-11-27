import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChatModel, getAIProvider } from '../provider';
import { buildSystemPrompt, getVietnamTimeContext } from '../system-prompt';
import { ListUpcomingEventsSchema, ProposeMeetingSchema, createCalendarTools } from '../tools';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function createMockSession() {
  return {
    user: { id: 'person', email: 'person@example.com', name: 'Người dùng' },
    tokens: { accessToken: 'access', expiresAt: Date.now() + 3600000, tokenType: 'Bearer' as const, scope: 'calendar' },
    createdAt: Date.now(),
  };
}

describe('AI & LLM Integration Layer', () => {
  it('uses the requested daysAhead interval for Calendar lookup', async () => {
    const mockFetch = vi.fn().mockResolvedValue(Response.json({ items: [] }));
    vi.stubGlobal('fetch', mockFetch);
    const session = {
      user: { id: 'person', email: 'person@example.com', name: 'Người dùng' },
      tokens: { accessToken: 'access', expiresAt: Date.now() + 3600000, tokenType: 'Bearer' as const, scope: 'calendar' },
      createdAt: Date.now(),
    };
    const before = Date.now();
    await createCalendarTools(session, 'access').listUpcomingEvents.execute?.({ maxResults: 3, daysAhead: 2 }, { toolCallId: 'lookup', messages: [] });
    const url = new URL(mockFetch.mock.calls[0][0]);
    const deadline = Date.parse(url.searchParams.get('timeMax') || '');
    expect(deadline).toBeGreaterThanOrEqual(before + 2 * 86400000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + 2 * 86400000);
    expect(url.searchParams.get('maxResults')).toBe('3');
  });

  it('bounds "today" lookup to Asia/Ho_Chi_Minh calendar day in the evening and excludes tomorrow events', async () => {
    vi.useFakeTimers();
    // 20:00 on Wednesday 11/11/2026 GMT+7
    vi.setSystemTime(new Date('2026-11-11T13:00:00Z'));

    const mockFetch = vi.fn().mockResolvedValue(Response.json({
      items: [
        {
          id: 'earlier-today',
          summary: 'Họp sáng nay',
          start: { dateTime: '2026-11-11T09:00:00+07:00' },
          end: { dateTime: '2026-11-11T10:00:00+07:00' },
          htmlLink: 'https://calendar.google.com/event?eid=earlier',
        },
        {
          id: 'tonight',
          summary: 'Họp tối nay',
          start: { dateTime: '2026-11-11T21:00:00+07:00' },
          end: { dateTime: '2026-11-11T22:00:00+07:00' },
          htmlLink: 'https://calendar.google.com/event?eid=tonight',
        },
        {
          id: 'tomorrow-morning',
          summary: 'Họp sáng mai',
          start: { dateTime: '2026-11-12T08:00:00+07:00' },
          end: { dateTime: '2026-11-12T09:00:00+07:00' },
          htmlLink: 'https://calendar.google.com/event?eid=tomorrow',
        },
        {
          id: 'tomorrow-all-day',
          summary: 'Sự kiện cả ngày mai',
          start: { date: '2026-11-12' },
          end: { date: '2026-11-13' },
          htmlLink: 'https://calendar.google.com/event?eid=tomorrow-allday',
        },
      ],
    }));
    vi.stubGlobal('fetch', mockFetch);

    const result = await createCalendarTools(createMockSession(), 'access').listUpcomingEvents.execute?.(
      { range: 'today' },
      { toolCallId: 'lookup-today', messages: [] }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get('timeMin')).toBe('2026-11-11T00:00:00+07:00');
    expect(url.searchParams.get('timeMax')).toBe('2026-11-12T00:00:00+07:00');
    expect(url.searchParams.get('maxResults')).toBe('50');
    expect(result).toMatchObject({
      success: true,
      mode: 'google',
      timeZone: 'Asia/Ho_Chi_Minh',
      timeMin: '2026-11-11T00:00:00+07:00',
      timeMax: '2026-11-12T00:00:00+07:00',
    });
    if (result && 'events' in result && result.events) {
      expect(result.events.map((event) => event.id)).toEqual(['earlier-today', 'tonight']);
    }
  });

  it('preserves zero-duration Google Calendar events with omitted end in listUpcomingEvents tool results', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T01:00:00Z'));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      items: [
        {
          id: 'zero-omitted-end',
          summary: 'Nhắc gửi tài liệu',
          endTimeUnspecified: true,
          start: { dateTime: '2026-11-24T09:45:00+07:00' },
        },
        {
          id: 'regular-today',
          summary: 'Họp chiều',
          start: { dateTime: '2026-11-24T14:00:00+07:00' },
          end: { dateTime: '2026-11-24T15:00:00+07:00' },
        },
      ],
    })));

    const result = await createCalendarTools(createMockSession(), 'access').listUpcomingEvents.execute?.(
      { range: 'today' },
      { toolCallId: 'lookup-zero-duration', messages: [] }
    );

    expect(result).toMatchObject({ success: true, mode: 'google' });
    if (result && 'events' in result && result.events) {
      expect(result.events).toEqual([
        expect.objectContaining({
          id: 'zero-omitted-end',
          summary: 'Nhắc gửi tài liệu',
          start: '2026-11-24T09:45:00+07:00',
          end: '2026-11-24T09:45:00+07:00',
          isAllDay: false,
        }),
        expect.objectContaining({
          id: 'regular-today',
          summary: 'Họp chiều',
          start: '2026-11-24T14:00:00+07:00',
          end: '2026-11-24T15:00:00+07:00',
          isAllDay: false,
        }),
      ]);
    }

    // Mid-day upcoming lookup (12:30 GMT+7) must keep an ongoing all-day event with omitted end via the 24h fallback
    vi.setSystemTime(new Date('2026-11-24T05:30:00Z'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      items: [
        {
          id: 'all-day-omitted-end',
          summary: 'Nghỉ lễ',
          start: { date: '2026-11-24' },
        },
        {
          id: 'afternoon-zero-omitted-end',
          summary: 'Nhắc nộp báo cáo chiều',
          endTimeUnspecified: true,
          start: { dateTime: '2026-11-24T15:00:00+07:00' },
        },
      ],
    })));

    const midDayUpcoming = await createCalendarTools(createMockSession(), 'access').listUpcomingEvents.execute?.(
      { range: 'upcoming' },
      { toolCallId: 'lookup-midday-all-day-omitted', messages: [] }
    );

    expect(midDayUpcoming).toMatchObject({ success: true, mode: 'google' });
    if (midDayUpcoming && 'events' in midDayUpcoming && midDayUpcoming.events) {
      expect(midDayUpcoming.events).toEqual([
        expect.objectContaining({
          id: 'all-day-omitted-end',
          summary: 'Nghỉ lễ',
          start: '2026-11-24',
          end: '',
          isAllDay: true,
        }),
        expect.objectContaining({
          id: 'afternoon-zero-omitted-end',
          summary: 'Nhắc nộp báo cáo chiều',
          start: '2026-11-24T15:00:00+07:00',
          end: '2026-11-24T15:00:00+07:00',
          isAllDay: false,
        }),
      ]);
    }
  });

  it('bounds "this_week" lookup to Monday-Sunday in Asia/Ho_Chi_Minh near the Sunday/Monday boundary', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ items: [] })));
    vi.stubGlobal('fetch', mockFetch);
    const session = createMockSession();
    const tools = createCalendarTools(session, 'access');

    // Sunday 2026-11-15 23:30 GMT+7 (still Sunday night in Vietnam) -> Mon Nov 9 .. Mon Nov 16
    vi.setSystemTime(new Date('2026-11-15T16:30:00Z'));
    await tools.listUpcomingEvents.execute?.({ range: 'this_week' }, { toolCallId: 'lookup-sun-night', messages: [] });
    const sundayUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(sundayUrl.searchParams.get('timeMin')).toBe('2026-11-09T00:00:00+07:00');
    expect(sundayUrl.searchParams.get('timeMax')).toBe('2026-11-16T00:00:00+07:00');

    // Monday 2026-11-16 00:30 GMT+7 (still Sunday 17:30 UTC, but Monday in Vietnam!) -> Mon Nov 16 .. Mon Nov 23
    vi.setSystemTime(new Date('2026-11-15T17:30:00Z'));
    await tools.listUpcomingEvents.execute?.({ range: 'this_week' }, { toolCallId: 'lookup-mon-early', messages: [] });
    const mondayUrl = new URL(mockFetch.mock.calls[1][0]);
    expect(mondayUrl.searchParams.get('timeMin')).toBe('2026-11-16T00:00:00+07:00');
    expect(mondayUrl.searchParams.get('timeMax')).toBe('2026-11-23T00:00:00+07:00');
  });

  it('supports explicit timezone-aware timeMin/timeMax separated from daysAhead', async () => {
    const mockFetch = vi.fn().mockResolvedValue(Response.json({ items: [] }));
    vi.stubGlobal('fetch', mockFetch);

    const parsedExplicit = ListUpcomingEventsSchema.safeParse({
      timeMin: '2026-11-11T20:00:00+07:00',
      timeMax: '2026-11-12T00:00:00+07:00',
    });
    expect(parsedExplicit.success).toBe(true);

    // Invalid combinations must be rejected by schema
    expect(ListUpcomingEventsSchema.safeParse({
      timeMin: '2026-11-11T00:00:00+07:00',
    }).success).toBe(false);
    expect(ListUpcomingEventsSchema.safeParse({
      timeMax: '2026-11-12T00:00:00+07:00',
    }).success).toBe(false);
    expect(ListUpcomingEventsSchema.safeParse({
      timeMin: '2026-11-11T00:00:00',
      timeMax: '2026-11-12T00:00:00',
    }).success).toBe(false);
    expect(ListUpcomingEventsSchema.safeParse({
      timeMin: '2026-11-12T00:00:00+07:00',
      timeMax: '2026-11-11T00:00:00+07:00',
    }).success).toBe(false);
    expect(ListUpcomingEventsSchema.safeParse({
      timeMin: '2026-11-11T00:00:00+07:00',
      timeMax: '2026-11-12T00:00:00+07:00',
      daysAhead: 1,
    }).success).toBe(false);
    expect(ListUpcomingEventsSchema.safeParse({
      timeMin: '2026-11-11T00:00:00+07:00',
      timeMax: '2026-11-12T00:00:00+07:00',
      range: 'today',
    }).success).toBe(false);
    expect(ListUpcomingEventsSchema.safeParse({
      range: 'today',
      daysAhead: 1,
    }).success).toBe(false);

    const invalidResult = await createCalendarTools(createMockSession(), 'access').listUpcomingEvents.execute?.(
      { range: 'today', daysAhead: 1 },
      { toolCallId: 'lookup-invalid', messages: [] }
    );
    expect(invalidResult).toMatchObject({ success: false });
    expect(mockFetch).not.toHaveBeenCalled();

    await createCalendarTools(createMockSession(), 'access').listUpcomingEvents.execute?.(
      {
        timeMin: '2026-11-11T20:00:00+07:00',
        timeMax: '2026-11-12T00:00:00+07:00',
      },
      { toolCallId: 'lookup-explicit', messages: [] }
    );
    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get('timeMin')).toBe('2026-11-11T20:00:00+07:00');
    expect(url.searchParams.get('timeMax')).toBe('2026-11-12T00:00:00+07:00');
  });

  it('paginates through empty and short pages after time filtering until maxResults or last page', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T02:00:00Z'));

    const emptyFirstFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'next' }))
      .mockResolvedValueOnce(Response.json({
        items: [
          {
            id: 'today-after-empty',
            summary: 'Họp hôm nay',
            start: { dateTime: '2026-11-11T10:00:00+07:00' },
            end: { dateTime: '2026-11-11T11:00:00+07:00' },
          },
        ],
      }));
    vi.stubGlobal('fetch', emptyFirstFetch);

    const emptyFirstResult = await createCalendarTools(createMockSession(), 'access').listUpcomingEvents.execute?.(
      { range: 'today' },
      { toolCallId: 'lookup-empty-first', messages: [] }
    );
    expect(emptyFirstFetch).toHaveBeenCalledTimes(2);
    expect(new URL(emptyFirstFetch.mock.calls[1][0]).searchParams.get('pageToken')).toBe('next');
    expect(emptyFirstResult).toMatchObject({ success: true });
    if (emptyFirstResult && 'events' in emptyFirstResult && emptyFirstResult.events) {
      expect(emptyFirstResult.events.map((event) => event.id)).toEqual(['today-after-empty']);
    }

    const filteredShortFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({
        items: [
          {
            id: 'tomorrow-all-day-out-of-range',
            summary: 'Nghỉ ngày mai',
            start: { date: '2026-11-12' },
            end: { date: '2026-11-13' },
          },
          {
            id: 'today-1',
            summary: 'Họp 1',
            start: { dateTime: '2026-11-11T09:00:00+07:00' },
            end: { dateTime: '2026-11-11T10:00:00+07:00' },
          },
        ],
        nextPageToken: 'page-2',
      }))
      .mockResolvedValueOnce(Response.json({
        items: [
          {
            id: 'today-2',
            summary: 'Họp 2',
            start: { dateTime: '2026-11-11T14:00:00+07:00' },
            end: { dateTime: '2026-11-11T15:00:00+07:00' },
          },
          {
            id: 'today-3',
            summary: 'Họp 3',
            start: { dateTime: '2026-11-11T16:00:00+07:00' },
            end: { dateTime: '2026-11-11T17:00:00+07:00' },
          },
        ],
        nextPageToken: 'page-3',
      }));
    vi.stubGlobal('fetch', filteredShortFetch);

    const filteredResult = await createCalendarTools(createMockSession(), 'access').listUpcomingEvents.execute?.(
      { range: 'today', maxResults: 2 },
      { toolCallId: 'lookup-filtered-short', messages: [] }
    );
    expect(filteredShortFetch).toHaveBeenCalledTimes(2);
    expect(filteredResult).toMatchObject({ success: true });
    if (filteredResult && 'events' in filteredResult && filteredResult.events) {
      expect(filteredResult.events.map((event) => event.id)).toEqual(['today-1', 'today-2']);
    }

    const satisfiedFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({
        items: [
          {
            id: 'sat-1',
            start: { dateTime: '2026-11-11T09:00:00+07:00' },
            end: { dateTime: '2026-11-11T10:00:00+07:00' },
          },
          {
            id: 'sat-2',
            start: { dateTime: '2026-11-11T11:00:00+07:00' },
            end: { dateTime: '2026-11-11T12:00:00+07:00' },
          },
        ],
        nextPageToken: 'page-2',
      }));
    vi.stubGlobal('fetch', satisfiedFetch);

    const satisfiedResult = await createCalendarTools(createMockSession(), 'access').listUpcomingEvents.execute?.(
      { range: 'today', maxResults: 2 },
      { toolCallId: 'lookup-satisfied', messages: [] }
    );
    expect(satisfiedFetch).toHaveBeenCalledTimes(1);
    expect(satisfiedResult).toMatchObject({ success: true });
    if (satisfiedResult && 'events' in satisfiedResult && satisfiedResult.events) {
      expect(satisfiedResult.events.map((event) => event.id)).toEqual(['sat-1', 'sat-2']);
    }

    // Even when page 1 fills maxResults with raw events that are all excluded by the time filter, keep paging.
    const allFilteredPageOneFetch = vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({
        items: [
          {
            id: 'out-1',
            start: { date: '2026-11-12' },
            end: { date: '2026-11-13' },
          },
          {
            id: 'out-2',
            start: { date: '2026-11-13' },
            end: { date: '2026-11-14' },
          },
        ],
        nextPageToken: 'page-2',
      }))
      .mockResolvedValueOnce(Response.json({
        items: [
          {
            id: 'in-after-filtered-page',
            start: { dateTime: '2026-11-11T15:00:00+07:00' },
            end: { dateTime: '2026-11-11T16:00:00+07:00' },
          },
        ],
      }));
    vi.stubGlobal('fetch', allFilteredPageOneFetch);

    const afterFilteredResult = await createCalendarTools(createMockSession(), 'access').listUpcomingEvents.execute?.(
      { range: 'today', maxResults: 2 },
      { toolCallId: 'lookup-after-filtered-page', messages: [] }
    );
    expect(allFilteredPageOneFetch).toHaveBeenCalledTimes(2);
    expect(afterFilteredResult).toMatchObject({ success: true });
    if (afterFilteredResult && 'events' in afterFilteredResult && afterFilteredResult.events) {
      expect(afterFilteredResult.events.map((event) => event.id)).toEqual(['in-after-filtered-page']);
    }
  });

  it('fails lookup rather than returning an empty success when pagination errors or repeats tokens', async () => {
    vi.stubGlobal('fetch', vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'next' }))
      .mockResolvedValueOnce(Response.json({ error: { message: 'Upstream failure' } }, { status: 500 })));

    const errorResult = await createCalendarTools(createMockSession(), 'access').listUpcomingEvents.execute?.(
      { range: 'today' },
      { toolCallId: 'lookup-page-error', messages: [] }
    );
    expect(errorResult).toMatchObject({ success: false });

    vi.stubGlobal('fetch', vi.fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'loop' }))
      .mockResolvedValueOnce(Response.json({ items: [], nextPageToken: 'loop' })));

    const loopResult = await createCalendarTools(createMockSession(), 'access').listUpcomingEvents.execute?.(
      { range: 'today' },
      { toolCallId: 'lookup-page-loop', messages: [] }
    );
    expect(loopResult).toMatchObject({ success: false });
  });

  it('filters dev mock events to the requested Vietnam day range', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');

    // Default mock event is scheduled 24h in the future (tomorrow), so querying today must not include it
    const result = await createCalendarTools().listUpcomingEvents.execute?.(
      { range: 'today' },
      { toolCallId: 'lookup-mock-today', messages: [] }
    );
    expect(result).toMatchObject({ success: true, mode: 'mock', isMock: true });
    if (result && 'events' in result && result.events) {
      expect(result.events.some((event) => event.id === 'mock-event-1')).toBe(false);
    }
  });

  it('does not use mock Calendar data in production tools', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    const result = await createCalendarTools().listUpcomingEvents.execute?.({ maxResults: 3, daysAhead: 2 }, { toolCallId: 'lookup', messages: [] });
    expect(result).toMatchObject({ success: false });
    expect(result).not.toHaveProperty('isMock', true);
  });
  it('correctly provides Vietnam timezone context', () => {
    const testDate = new Date('2026-10-12T02:00:00Z'); // 09:00 AM Monday UTC+7
    const context = getVietnamTimeContext(testDate);

    expect(context.timeZone).toBe('Asia/Ho_Chi_Minh');
    expect(context.formattedDate).toContain('09:00');
    expect(context.formattedDate).toContain('2026');
    expect(context.todayRange).toEqual({
      timeMin: '2026-10-12T00:00:00+07:00',
      timeMax: '2026-10-13T00:00:00+07:00',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    expect(context.thisWeekRange).toEqual({
      timeMin: '2026-10-12T00:00:00+07:00',
      timeMax: '2026-10-19T00:00:00+07:00',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  });

  it('builds system prompt with mandatory Vietnamese instructions and safety rules', () => {
    const prompt = buildSystemPrompt('user@example.com', new Date('2026-11-11T13:00:00Z'));

    expect(prompt).toContain('Asia/Ho_Chi_Minh');
    expect(prompt).toContain('user@example.com');
    expect(prompt).toContain('proposeMeeting');
    expect(prompt).toContain('TUYỆT ĐỐI KHÔNG BAO GIỜ');
    expect(prompt).toContain('Chủ động tạo thẻ xem trước');
    expect(prompt).toContain('TỰ SUY LUẬN TIÊU ĐỀ');
    expect(prompt).toContain('60 phút');
    expect(prompt).toContain('createMeet');
    expect(prompt).toContain('MẶC ĐỊNH `false`');
    expect(prompt).toContain('2026-11-11T00:00:00+07:00');
    expect(prompt).toContain('2026-11-12T00:00:00+07:00');
    expect(prompt).toContain('2026-11-09T00:00:00+07:00');
    expect(prompt).toContain('2026-11-16T00:00:00+07:00');
    expect(prompt).toContain('range: "today"');
    expect(prompt).toContain('range: "this_week"');

    const guestPrompt = buildSystemPrompt(undefined, new Date('2026-11-11T13:00:00Z'));
    expect(guestPrompt).not.toContain('Email người dùng hiện tại:');
  });

  it('includes disambiguation rules for meridiem-free hours, explicit meridiem hours, and relative dates', () => {
    const prompt = buildSystemPrompt('user@example.com', new Date('2026-11-11T13:00:00Z'));

    // Giờ kèm buổi vs giờ không kèm buổi (1h, 5h, 6h, 7h, 11h, 12h + 7h sáng vs 7h tối)
    expect(prompt).toContain('7h sáng');
    expect(prompt).toContain('7h tối');
    for (const hourToken of ['`1h`', '`5h`', '`6h`', '`7h`', '`11h`', '`12h`']) {
      expect(prompt).toContain(hourToken);
    }
    expect(prompt).toMatch(/hỏi lại.*sáng hay tối/i);
    expect(prompt).toMatch(/hỏi lại.*thay vì đoán/i);

    // Thời gian mơ hồ: sáng/chiều/tối mai thiếu giờ, ngày thiếu tháng, tuần sau, cuối tuần, thứ 2 tuần tới
    expect(prompt).toContain('"sáng mai", "chiều mai", "tối mai"');
    expect(prompt).toContain('"ngày 15"');
    expect(prompt).toContain('"tuần sau"');
    expect(prompt).toContain('"cuối tuần"');
    expect(prompt).toContain('"thứ 2 tuần tới"');
  });

  it('includes rules for conflict handling, unsupported edit/cancel/recurring actions, and Google reconnect guidance', () => {
    const prompt = buildSystemPrompt('user@example.com', new Date('2026-11-11T13:00:00Z'));

    // Luồng xử lý trùng lịch khớp với CalendarConflictChoices trên thẻ xem trước
    expect(prompt).toContain('Hủy lịch cũ');
    expect(prompt).toContain('Đổi giờ lịch cũ');
    expect(prompt).toContain('Vẫn tạo lịch mới, giữ lịch cũ');

    // Giới hạn công cụ: sửa/dời/hủy lịch đã tồn tại và lịch lặp lại chưa hỗ trợ
    expect(prompt).toContain('dời họp sang 3h');
    expect(prompt).toContain('hủy lịch mai');
    expect(prompt).toContain('họp hàng tuần');
    expect(prompt).toContain('recurrence');
    expect(prompt).toContain('Chưa hỗ trợ qua trò chuyện');
    expect(prompt).toMatch(/TUYỆT ĐỐI KHÔNG.*bịa ra tool/i);

    // Hướng dẫn kết nối lại khi lỗi 401/403 hoặc chưa đăng nhập Google (Web & Mobile)
    expect(prompt).toContain('google_reauthorization_required');
    expect(prompt).toContain('SESSION_REFRESH_REQUIRED');
    expect(prompt).toContain('google_calendar_permission_required');
    expect(prompt).toContain('Kết nối Google');
    expect(prompt).toContain('Lịch sắp tới');
    expect(prompt).toContain('Cài đặt & tài khoản');
  });

  it('validates proposeMeeting schema correctly', () => {
    const validData = {
      summary: 'Họp Review Dự Án',
      startDateTime: '2026-10-12T09:00:00+07:00',
      endDateTime: '2026-10-12T10:00:00+07:00',
      attendees: [{ email: 'colleague@example.com' }],
      createMeet: true,
    };

    const parsed = ProposeMeetingSchema.safeParse(validData);
    expect(parsed.success).toBe(true);

    const invalidEmail = {
      ...validData,
      attendees: [{ email: 'not-an-email' }],
    };
    const invalidParsed = ProposeMeetingSchema.safeParse(invalidEmail);
    expect(invalidParsed.success).toBe(false);
  });

  it('rejects invalid proposal times rather than silently replacing them', async () => {
    const tools = createCalendarTools();
    const execute = tools.proposeMeeting.execute;
    expect(execute).toBeDefined();

    if (execute) {
      // Start time later than end time
      await expect(execute({
        summary: 'Họp Bất Thường',
        description: 'Chi tiết',
        startDateTime: '2026-10-12T10:00:00+07:00',
        endDateTime: '2026-10-12T09:00:00+07:00', // Invalid end
        timeZone: 'Asia/Ho_Chi_Minh',
        attendees: [],
        createMeet: true,
      }, { toolCallId: 'call-1', messages: [] })).rejects.toThrow('Thời gian kết thúc phải sau thời gian bắt đầu');
    }
  });

  it('only prepares a valid preview with a server-generated proposal ID', async () => {
    const execute = createCalendarTools().proposeMeeting.execute;
    expect(execute).toBeDefined();
    if (!execute) return;
    const result = await execute({
      summary: 'Họp dự án',
      description: '',
      startDateTime: '2026-10-12T09:00:00+07:00',
      endDateTime: '2026-10-12T10:00:00+07:00',
      timeZone: 'Asia/Ho_Chi_Minh',
      attendees: [],
      createMeet: false,
    }, { toolCallId: 'call-2', messages: [] });
    expect(result).toMatchObject({ status: 'proposed', createMeet: false, startDateTime: '2026-10-12T02:00:00.000Z', endDateTime: '2026-10-12T03:00:00.000Z' });
    expect(result.proposalId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('configures AI provider with generic environment specs', () => {
    process.env.AI_API_KEY = 'test-ai-key';
    process.env.AI_MODEL = 'test-chat-model';
    process.env.AI_BASE_URL = 'https://api.openai.com/v1';

    const provider = getAIProvider();
    expect(provider).toBeDefined();

    const model = getChatModel();
    expect(model.modelId).toBe('test-chat-model');
  });

  it('supports selecting different or custom AI models', () => {
    process.env.AI_API_KEY = 'test-ai-key';
    process.env.AI_MODEL = 'default-model';

    const customModel1 = getChatModel('custom-org/model-a');
    expect(customModel1.modelId).toBe('custom-org/model-a');

    const customModel2 = getChatModel('deepseek/deepseek-chat');
    expect(customModel2.modelId).toBe('deepseek/deepseek-chat');

    // Falls back to default when empty string or whitespace
    const fallbackModel = getChatModel('   ');
    expect(fallbackModel.modelId).toBe('default-model');
  });

  describe('listUpcomingEvents 401 recovery and session-aware guidance (#74)', () => {
    function createWebSessionWithRefresh(refreshToken?: string) {
      return {
        user: { id: 'web-user-1', email: 'web@example.com', name: 'Người dùng Web' },
        tokens: {
          accessToken: 'stale-web-access',
          ...(refreshToken ? { refreshToken } : {}),
          expiresAt: Date.now() + 50 * 60 * 1000,
          tokenType: 'Bearer' as const,
          scope: 'https://www.googleapis.com/auth/calendar.events',
        },
        createdAt: Date.now(),
      };
    }

    function createMobileBearerSession() {
      const now = Date.now();
      return {
        kind: 'mobile' as const,
        createdAt: now,
        expiresAt: now + 7 * 24 * 60 * 60 * 1000,
        user: { id: 'mobile-user-1', email: 'mobile@example.com', name: 'Người dùng Mobile' },
        tokens: {
          accessToken: 'stale-mobile-access',
          refreshToken: 'mobile-refresh-token',
          expiresAt: now + 50 * 60 * 1000,
          tokenType: 'Bearer' as const,
          scope: 'https://www.googleapis.com/auth/calendar.events',
        },
      };
    }

    it('refreshes Web access token once when Google Calendar returns 401 and succeeds on retry', async () => {
      vi.stubEnv('GOOGLE_CLIENT_ID', 'web-client-id');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', 'web-client-secret');

      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          return Response.json({
            access_token: 'fresh-web-access',
            refresh_token: 'rotated-web-refresh',
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'https://www.googleapis.com/auth/calendar.events',
          });
        }
        const auth = new Headers(init?.headers).get('Authorization');
        if (auth === 'Bearer stale-web-access') {
          return Response.json(
            { error: { code: 401, message: 'Invalid Credentials' } },
            { status: 401 }
          );
        }
        if (auth === 'Bearer fresh-web-access') {
          return Response.json({
            items: [
              {
                id: 'recovered-event-1',
                summary: 'Họp sau khi làm mới token',
                start: { dateTime: new Date(Date.now() + 3600_000).toISOString() },
                end: { dateTime: new Date(Date.now() + 7200_000).toISOString() },
              },
            ],
          });
        }
        throw new Error(`Unexpected Authorization header: ${auth}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      const webSession = createWebSessionWithRefresh('valid-web-refresh');
      const tools = createCalendarTools(webSession, webSession.tokens.accessToken);
      const result = await tools.listUpcomingEvents.execute?.(
        { daysAhead: 7 },
        { toolCallId: 'lookup-401-recover', messages: [] }
      );

      expect(result).toMatchObject({
        success: true,
        mode: 'google',
      });
      if (result && 'events' in result && result.events) {
        expect(result.events.map((e) => e.id)).toEqual(['recovered-event-1']);
      }

      const tokenCalls = fetchMock.mock.calls.filter(([url]) => url === 'https://oauth2.googleapis.com/token');
      const calendarCalls = fetchMock.mock.calls.filter(([url]) => url.includes('/calendars/primary/events'));
      expect(tokenCalls).toHaveLength(1);
      expect(calendarCalls).toHaveLength(2);

      // Subsequent tool call in the same turn reuses the refreshed token without hitting 401 again
      const secondResult = await tools.listUpcomingEvents.execute?.(
        { daysAhead: 7 },
        { toolCallId: 'lookup-401-second', messages: [] }
      );
      expect(secondResult).toMatchObject({ success: true, mode: 'google' });
      expect(fetchMock.mock.calls.filter(([url]) => url === 'https://oauth2.googleapis.com/token')).toHaveLength(1);
      expect(fetchMock.mock.calls.filter(([url]) => url.includes('/calendars/primary/events'))).toHaveLength(3);
    });

    it('deduplicates concurrent 401 refreshes in the same turn and stops cleanly if the refreshed token also receives 401 or OAuth 502', async () => {
      vi.stubEnv('GOOGLE_CLIENT_ID', 'web-client-id');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', 'web-client-secret');

      // 1. Concurrent parallel tool calls share one single-flight refresh
      const parallelFetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return Response.json({
            access_token: 'parallel-fresh-access',
            refresh_token: 'valid-refresh',
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'https://www.googleapis.com/auth/calendar.events',
          });
        }
        const auth = new Headers(init?.headers).get('Authorization');
        if (auth === 'Bearer stale-web-access') {
          return Response.json({ error: { code: 401, message: 'Invalid Credentials' } }, { status: 401 });
        }
        return Response.json({ items: [] });
      });
      vi.stubGlobal('fetch', parallelFetch);

      const parallelTools = createCalendarTools(
        createWebSessionWithRefresh('valid-refresh'),
        'stale-web-access'
      );
      const [resA, resB] = await Promise.all([
        parallelTools.listUpcomingEvents.execute?.({ daysAhead: 1 }, { toolCallId: 'p-1', messages: [] }),
        parallelTools.listUpcomingEvents.execute?.({ daysAhead: 3 }, { toolCallId: 'p-2', messages: [] }),
      ]);
      expect(resA).toMatchObject({ success: true, mode: 'google' });
      expect(resB).toMatchObject({ success: true, mode: 'google' });
      expect(parallelFetch.mock.calls.filter(([url]) => url === 'https://oauth2.googleapis.com/token')).toHaveLength(1);

      // 2. Refreshed token STILL returns 401 -> fails cleanly without infinite retry loop
      const double401Fetch = vi.fn(async (url: string) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          return Response.json({
            access_token: 'still-invalid-access',
            refresh_token: 'valid-refresh',
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'https://www.googleapis.com/auth/calendar.events',
          });
        }
        return Response.json({ error: { code: 401, message: 'Still Unauthorized' } }, { status: 401 });
      });
      vi.stubGlobal('fetch', double401Fetch);

      const double401Result = await createCalendarTools(
        createWebSessionWithRefresh('valid-refresh'),
        'stale-web-access'
      ).listUpcomingEvents.execute?.({ range: 'today' }, { toolCallId: 'double-401', messages: [] });

      expect(double401Result).toMatchObject({
        success: false,
        code: 'google_reauthorization_required',
      });
      expect(JSON.stringify(double401Result)).not.toContain('Still Unauthorized');
      expect(double401Fetch.mock.calls.filter(([url]) => url === 'https://oauth2.googleapis.com/token')).toHaveLength(1);
      expect(double401Fetch.mock.calls.filter(([url]) => url.includes('/calendars/primary/events'))).toHaveLength(2);

      // 3. Transient Google OAuth 503 during refresh does not falsely claim grant revocation
      const transientOAuthFetch = vi.fn(async (url: string) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          return Response.json({ error: 'temporarily_unavailable' }, { status: 503 });
        }
        return Response.json({ error: { code: 401, message: 'Invalid Credentials' } }, { status: 401 });
      });
      vi.stubGlobal('fetch', transientOAuthFetch);

      const transientResult = await createCalendarTools(
        createWebSessionWithRefresh('valid-refresh'),
        'stale-web-access'
      ).listUpcomingEvents.execute?.({ range: 'today' }, { toolCallId: 'transient-503', messages: [] });

      expect(transientResult).toMatchObject({ success: false });
      expect(transientResult).not.toHaveProperty('code', 'google_reauthorization_required');
      expect(JSON.stringify(transientResult)).not.toContain('temporarily_unavailable');
    });

    it('returns google_reauthorization_required with reconnect instructions (not "Chưa kết nối tài khoản Google") when Web session has null accessToken or revoked refresh', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('GOOGLE_CLIENT_ID', '');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', '');

      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      // 1. Pre-stream refresh already failed -> session exists, accessToken is null
      const webSession = createWebSessionWithRefresh('revoked-refresh');
      const nullTokenResult = await createCalendarTools(webSession, null).listUpcomingEvents.execute?.(
        { range: 'today' },
        { toolCallId: 'lookup-null-token', messages: [] }
      );

      expect(nullTokenResult).toMatchObject({
        success: false,
        code: 'google_reauthorization_required',
      });
      expect(nullTokenResult).not.toHaveProperty('isMock');
      if (nullTokenResult && 'error' in nullTokenResult) {
        expect(nullTokenResult.error).not.toContain('Chưa kết nối tài khoản Google');
        expect(nullTokenResult.error).toMatch(/đăng xuất.*kết nối lại|kết nối lại tài khoản Google/i);
      }
      expect(fetchMock).not.toHaveBeenCalled();

      // 2. Mid-stream 401 with revoked refresh grant -> returns google_reauthorization_required without leaking Google error payload
      vi.stubEnv('GOOGLE_CLIENT_ID', 'web-client-id');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', 'web-client-secret');
      const revokedFetch = vi.fn(async (url: string) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          return Response.json(
            { error: 'invalid_grant', error_description: 'Token has been expired or revoked-secret-detail' },
            { status: 400 }
          );
        }
        return Response.json(
          { error: { code: 401, message: 'Invalid Credentials Secret' } },
          { status: 401 }
        );
      });
      vi.stubGlobal('fetch', revokedFetch);

      const revokedResult = await createCalendarTools(webSession, webSession.tokens.accessToken).listUpcomingEvents.execute?.(
        { range: 'today' },
        { toolCallId: 'lookup-revoked-refresh', messages: [] }
      );

      expect(revokedResult).toMatchObject({
        success: false,
        code: 'google_reauthorization_required',
      });
      expect(JSON.stringify(revokedResult)).not.toContain('revoked-secret-detail');
      expect(JSON.stringify(revokedResult)).not.toContain('Invalid Credentials Secret');
      if (revokedResult && 'error' in revokedResult) {
        expect(revokedResult.error).not.toContain('Chưa kết nối tài khoản Google');
        expect(revokedResult.error).toMatch(/đăng xuất.*kết nối lại|kết nối lại tài khoản Google/i);
      }

      // 3. Mid-stream 401 without refreshToken -> fails cleanly with google_reauthorization_required
      const noRefreshSession = createWebSessionWithRefresh(undefined);
      const noRefreshFetch = vi.fn().mockResolvedValue(
        Response.json({ error: { code: 401, message: 'Invalid Credentials' } }, { status: 401 })
      );
      vi.stubGlobal('fetch', noRefreshFetch);

      const noRefreshResult = await createCalendarTools(noRefreshSession, noRefreshSession.tokens.accessToken).listUpcomingEvents.execute?.(
        { range: 'today' },
        { toolCallId: 'lookup-no-refresh-token', messages: [] }
      );
      expect(noRefreshResult).toMatchObject({
        success: false,
        code: 'google_reauthorization_required',
      });
      expect(noRefreshFetch).toHaveBeenCalledTimes(1);
    });

    it('never refreshes Mobile Bearer grants on the server or falls back to mock when Google Calendar returns 401', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('GOOGLE_CLIENT_ID', '');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', '');

      const mobileSession = createMobileBearerSession();
      const mobileFetch = vi.fn().mockResolvedValue(
        Response.json({ error: { code: 401, message: 'Mobile Invalid Credentials' } }, { status: 401 })
      );
      vi.stubGlobal('fetch', mobileFetch);

      const result = await createCalendarTools(mobileSession, mobileSession.tokens.accessToken).listUpcomingEvents.execute?.(
        { range: 'today' },
        { toolCallId: 'lookup-mobile-401', messages: [] }
      );

      expect(result).toMatchObject({
        success: false,
        code: 'SESSION_REFRESH_REQUIRED',
      });
      expect(result).not.toHaveProperty('isMock');
      expect(JSON.stringify(result)).not.toContain('Mobile Invalid Credentials');
      expect(mobileFetch).toHaveBeenCalledTimes(1);
      expect(mobileFetch.mock.calls.some(([url]) => String(url).includes('oauth2.googleapis.com'))).toBe(false);

      // Even if mobile accessToken were null, never fall back to mock events
      const nullMobileResult = await createCalendarTools(mobileSession, null).listUpcomingEvents.execute?.(
        { range: 'today' },
        { toolCallId: 'lookup-mobile-null', messages: [] }
      );
      expect(nullMobileResult).toMatchObject({
        success: false,
        code: 'SESSION_REFRESH_REQUIRED',
      });
      expect(nullMobileResult).not.toHaveProperty('isMock');
    });
  });
});
