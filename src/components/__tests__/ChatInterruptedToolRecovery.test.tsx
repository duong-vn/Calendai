import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { resetChatRateLimit } from '@/lib/chat/rate-limit';
import { createNewSession, saveCurrentSession, setActiveSessionId } from '@/lib/chat/session-storage';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  access: vi.fn(),
  authError: vi.fn(),
  chatModel: vi.fn(),
}));

vi.mock('next/dynamic', () => ({ default: () => () => null }));
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

beforeEach(() => {
  localStorage.clear();
  resetChatRateLimit();
  mocks.session.mockResolvedValue(null);
  mocks.authError.mockReturnValue(null);
  mocks.chatModel.mockReturnValue(
    new MockLanguageModelV1({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: 'Phản hồi tiếp theo thành công!' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 12, completionTokens: 6 },
            },
          ],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    })
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('End-to-end Web recovery after interrupted tool invocations', () => {
  it('shows incomplete state after reload and continues the conversation via follow-up message and reload against real POST /api/chat', async () => {
    const session = createNewSession(undefined, 'guest');
    saveCurrentSession(
      {
        ...session,
        title: 'Họp dự án sáng mai',
        messages: [
          { id: 'u-1', role: 'user', content: 'Đặt lịch họp dự án sáng mai 9h' },
          {
            id: 'a-interrupted',
            role: 'assistant',
            content: '',
            toolInvocations: [
              {
                state: 'call',
                toolCallId: 'call-interrupted-1',
                toolName: 'proposeMeeting',
                args: { summary: 'Họp dự án' },
              },
            ],
          },
        ],
      },
      'guest'
    );
    setActiveSessionId(session.id, 'guest');

    let failOnce = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url === '/api/chat' || url.endsWith('/api/chat')) {
          if (failOnce) {
            failOnce = false;
            return Response.json({ error: 'Mạng tạm thời gián đoạn.' }, { status: 503 });
          }
          return POST(
            new Request('https://calendai.tduong.online/api/chat', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Origin: 'https://calendai.tduong.online',
                'Sec-Fetch-Site': 'same-origin',
              },
              body: init?.body,
              signal: init?.signal,
            })
          );
        }
        return Response.json({ authenticated: false, user: null, isConfigured: true });
      })
    );

    render(<Home />);

    // Interrupted tool invocation from localStorage renders incomplete notice, NOT infinite spinner
    expect(await screen.findByText('Chưa hoàn tất tạo bản thảo cuộc họp.')).toBeInTheDocument();
    expect(screen.getByText('Hãy nhắn yêu cầu lại để trợ lý tiếp tục.')).toBeInTheDocument();
    expect(
      screen.queryByText('Đang chuẩn bị thẻ xem trước Google Calendar...')
    ).not.toBeInTheDocument();

    // User sends a follow-up message; first network attempt fails so we can also exercise reload()
    const input = screen.getByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(input, { target: { value: 'Đặt lại lịch họp sáng mai 9h nhé' } });
    fireEvent.submit(input.closest('form')!);

    // Error banner appears; clicking "Thử lại" triggers reload() with the interrupted history still present
    const retryButton = await screen.findByRole('button', { name: 'Thử lại' });
    await act(async () => {
      fireEvent.click(retryButton);
    });

    // Real POST /api/chat + AI SDK streamText succeeds without 500 and streams assistant reply
    expect(await screen.findByText('Phản hồi tiếp theo thành công!')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
    });
  });
});
