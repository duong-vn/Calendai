import { describe, expect, it } from 'vitest';
import { getChatModel, getOpenRouterProvider } from '../provider';
import { buildSystemPrompt, getVietnamTimeContext } from '../system-prompt';
import { ProposeMeetingSchema, createCalendarTools } from '../tools';

describe('AI & LLM Integration Layer', () => {
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

  it('executes proposeMeeting tool safely and adjusts end time if earlier than start', async () => {
    const tools = createCalendarTools();
    const execute = tools.proposeMeeting.execute;
    expect(execute).toBeDefined();

    if (execute) {
      // Start time later than end time
      const result = await execute({
        summary: 'Họp Bất Thường',
        description: 'Chi tiết',
        startDateTime: '2026-10-12T10:00:00+07:00',
        endDateTime: '2026-10-12T09:00:00+07:00', // Invalid end
        timeZone: 'Asia/Ho_Chi_Minh',
        attendees: [],
        createMeet: true,
      }, { toolCallId: 'call-1', messages: [] });

      expect(result.proposalId).toBeDefined();
      expect(result.summary).toBe('Họp Bất Thường');
      expect(new Date(result.endDateTime).getTime()).toBeGreaterThan(
        new Date(result.startDateTime).getTime()
      );
    }
  });

  it('configures OpenRouter provider with mandatory environment specs', () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.OPENROUTER_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

    const provider = getOpenRouterProvider();
    expect(provider).toBeDefined();

    const model = getChatModel();
    expect(model.modelId).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
  });
});
