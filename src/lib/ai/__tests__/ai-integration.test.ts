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
    expect(prompt).toContain('2026-11-11T00:00:00+07:00');
    expect(prompt).toContain('2026-11-12T00:00:00+07:00');
    expect(prompt).toContain('2026-11-09T00:00:00+07:00');
    expect(prompt).toContain('2026-11-16T00:00:00+07:00');
    expect(prompt).toContain('range: "today"');
    expect(prompt).toContain('range: "this_week"');
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
});
