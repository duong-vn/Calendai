import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChatModel, getAIProvider } from '../provider';
import { buildSystemPrompt, getVietnamTimeContext } from '../system-prompt';
import { ProposeMeetingSchema, createCalendarTools } from '../tools';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

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

  it('does not use mock Calendar data in production tools', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    const result = await createCalendarTools().listUpcomingEvents.execute?.({ maxResults: 3, daysAhead: 2 }, { toolCallId: 'lookup', messages: [] });
    expect(result).toMatchObject({ success: false });
    expect(result).not.toHaveProperty('isMock', true);
  });
  it('correctly provides Vietnam timezone context', () => {
    const testDate = new Date('2026-10-12T02:00:00Z'); // 09:00 AM UTC+7
    const context = getVietnamTimeContext(testDate);

    expect(context.timeZone).toBe('Asia/Ho_Chi_Minh');
    expect(context.formattedDate).toContain('09:00');
    expect(context.formattedDate).toContain('2026');
  });

  it('builds system prompt with mandatory Vietnamese instructions and safety rules', () => {
    const prompt = buildSystemPrompt('user@example.com');

    expect(prompt).toContain('Asia/Ho_Chi_Minh');
    expect(prompt).toContain('user@example.com');
    expect(prompt).toContain('proposeMeeting');
    expect(prompt).toContain('TUYỆT ĐỐI KHÔNG BAO GIỜ');
    expect(prompt).toContain('Chủ động tạo thẻ xem trước');
    expect(prompt).toContain('TỰ SUY LUẬN TIÊU ĐỀ');
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
