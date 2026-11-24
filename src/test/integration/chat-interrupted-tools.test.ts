// @vitest-environment node
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetChatRateLimit } from '@/lib/chat/rate-limit';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  access: vi.fn(),
  authError: vi.fn(),
  chatModel: vi.fn(),
}));

vi.mock('@/lib/auth/server-session', () => ({
  getServerSession: mocks.session,
  getValidAccessToken: mocks.access,
  authErrorResponse: mocks.authError,
}));
vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({
    AI_API_KEY: 'test-key',
    AI_MODEL: 'configured-model',
    AI_BASE_URL: 'https://api.openai.com/v1',
  }),
}));
vi.mock('@/lib/ai/provider', () => ({
  getChatModel: mocks.chatModel,
}));

import { POST } from '@/app/api/chat/route';

function createMockModel(onDoStream?: (options: Parameters<MockLanguageModelV1['doStream']>[0]) => void) {
  return new MockLanguageModelV1({
    doStream: async (options) => {
      onDoStream?.(options);
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: 'Đã tiếp tục hội thoại bình thường.' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 8 },
            },
          ],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

function chatRequest(messages: unknown[], authorization?: string) {
  return new Request('https://calendai.tduong.online/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization
        ? { Authorization: authorization }
        : { Origin: 'https://calendai.tduong.online', 'Sec-Fetch-Site': 'same-origin' }),
    },
    body: JSON.stringify({ messages }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  resetChatRateLimit();
  mocks.session.mockResolvedValue(null);
  mocks.authError.mockReturnValue(null);
});

describe('POST /api/chat recovery after interrupted AI tool invocations (real AI SDK)', () => {
  it('succeeds when history contains toolInvocations and parts in call and partial-call states while preserving completed result invocations and text', async () => {
    let capturedPrompt: Parameters<MockLanguageModelV1['doStream']>[0]['prompt'] | undefined;
    mocks.chatModel.mockReturnValue(
      createMockModel((options) => {
        capturedPrompt = options.prompt;
      })
    );

    const completedProposal = {
      proposalId: 'prop-1',
      summary: 'Họp Sprint',
      startDateTime: '2026-11-25T09:00:00+07:00',
      endDateTime: '2026-11-25T10:00:00+07:00',
      timeZone: 'Asia/Ho_Chi_Minh',
      attendees: [],
      createMeet: true,
    };

    const completedTool = {
      state: 'result' as const,
      step: 0,
      toolCallId: 'done-1',
      toolName: 'proposeMeeting',
      args: { summary: 'Họp Sprint' },
      result: completedProposal,
    };

    const interruptedCallTool = {
      state: 'call' as const,
      step: 0,
      toolCallId: 'interrupted-call-1',
      toolName: 'proposeMeeting',
      args: { summary: 'Họp dở dang' },
    };

    const interruptedPartialTool = {
      state: 'partial-call' as const,
      step: 1,
      toolCallId: 'interrupted-partial-1',
      toolName: 'listUpcomingEvents',
      args: { range: 'today' },
    };

    const response = await POST(
      chatRequest([
        {
          role: 'user',
          content: 'Lên lịch họp Sprint sáng mai 9h',
          parts: [{ type: 'text', text: 'Lên lịch họp Sprint sáng mai 9h' }],
        },
        {
          role: 'assistant',
          content: 'Tôi đã tạo bản thảo cuộc họp Sprint.',
          toolInvocations: [completedTool],
          parts: [
            { type: 'step-start' },
            { type: 'tool-invocation', toolInvocation: completedTool },
            { type: 'text', text: 'Tôi đã tạo bản thảo cuộc họp Sprint.' },
          ],
        },
        {
          role: 'user',
          content: 'Tạo thêm lịch họp dở dang',
          parts: [{ type: 'text', text: 'Tạo thêm lịch họp dở dang' }],
        },
        // Interrupted assistant turn with NO text and state: 'call' (typical stop/abort mid-tool)
        {
          role: 'assistant',
          content: '',
          toolInvocations: [interruptedCallTool],
          parts: [
            { type: 'step-start' },
            { type: 'tool-invocation', toolInvocation: interruptedCallTool },
          ],
        },
        {
          role: 'user',
          content: 'Xem lịch hôm nay rồi đặt lại nhé',
          parts: [{ type: 'text', text: 'Xem lịch hôm nay rồi đặt lại nhé' }],
        },
        // Interrupted multi-step assistant turn with partial text + completed step 0 + partial-call step 1
        {
          role: 'assistant',
          content: 'Để tôi kiểm tra lịch hôm nay trước.',
          toolInvocations: [completedTool, interruptedPartialTool],
          parts: [
            { type: 'step-start' },
            { type: 'tool-invocation', toolInvocation: completedTool },
            { type: 'step-start' },
            { type: 'text', text: 'Để tôi kiểm tra lịch hôm nay trước.' },
            { type: 'tool-invocation', toolInvocation: interruptedPartialTool },
          ],
        },
        {
          role: 'user',
          content: 'Tiếp tục giúp tôi nhé',
          parts: [{ type: 'text', text: 'Tiếp tục giúp tôi nhé' }],
        },
      ])
    );

    expect(response.status).toBe(200);
    const streamBody = await response.text();
    expect(streamBody).toContain('Đã tiếp tục hội thoại bình thường.');
    expect(capturedPrompt).toBeDefined();

    // Completed tool call + tool result are preserved
    const toolCallParts = capturedPrompt!
      .filter((msg) => msg.role === 'assistant')
      .flatMap((msg) => msg.content)
      .filter((part) => part.type === 'tool-call');
    expect(toolCallParts.map((part) => part.toolCallId)).toEqual(['done-1', 'done-1']);

    const toolResultParts = capturedPrompt!
      .filter((msg) => msg.role === 'tool')
      .flatMap((msg) => msg.content);
    expect(toolResultParts.map((part) => part.toolCallId)).toEqual(['done-1', 'done-1']);

    // Assistant text from both completed and partially streamed turns is preserved
    const assistantTexts = capturedPrompt!
      .filter((msg) => msg.role === 'assistant')
      .flatMap((msg) => msg.content)
      .filter((part) => part.type === 'text')
      .map((part) => part.text);
    expect(assistantTexts).toContain('Tôi đã tạo bản thảo cuộc họp Sprint.');
    expect(assistantTexts).toContain('Để tôi kiểm tra lịch hôm nay trước.');

    // Empty interrupted assistant turn (no text, no completed tools) is omitted cleanly
    const emptyAssistantMessages = capturedPrompt!.filter(
      (msg) => msg.role === 'assistant' && msg.content.length === 0
    );
    expect(emptyAssistantMessages).toHaveLength(0);
  });

  it('supports Mobile Bearer follow-up and reload after toolInvocations-only call/partial-call history', async () => {
    mocks.session.mockResolvedValue({
      kind: 'mobile',
      user: { id: 'mobile-user-1', email: 'mobile@example.com' },
    });
    mocks.access.mockResolvedValue({ accessToken: 'mobile-access-token' });
    mocks.chatModel.mockReturnValue(createMockModel());

    // Mobile history persisted without parts (or filled by useChat on next send/reload)
    const response = await POST(
      chatRequest(
        [
          { role: 'user', content: 'Xem lịch hôm nay' },
          {
            role: 'assistant',
            content: 'Đang kiểm tra lịch...',
            toolInvocations: [
              {
                state: 'partial-call',
                toolCallId: 'mob-partial',
                toolName: 'listUpcomingEvents',
                args: {},
              },
            ],
          },
          {
            role: 'assistant',
            content: '',
            toolInvocations: [
              {
                state: 'call',
                toolCallId: 'mob-call',
                toolName: 'proposeMeeting',
                args: { summary: 'Họp nhóm' },
              },
            ],
          },
          { role: 'user', content: 'Hãy thử lại yêu cầu trên' },
        ],
        'Bearer mobile-jwe'
      )
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Đã tiếp tục hội thoại bình thường.');
  });

  it('does not crash with 500 even if request contains only an interrupted empty assistant message', async () => {
    mocks.chatModel.mockReturnValue(createMockModel());

    const response = await POST(
      chatRequest([
        {
          role: 'assistant',
          content: '',
          toolInvocations: [
            {
              state: 'call',
              toolCallId: 'solo-call',
              toolName: 'proposeMeeting',
              args: {},
            },
          ],
          parts: [
            { type: 'step-start' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'solo-call',
                toolName: 'proposeMeeting',
                args: {},
              },
            },
          ],
        },
      ])
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Đã tiếp tục hội thoại bình thường.');
  });
});
