import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { createNewSession, loadAllSessions, saveCurrentSession, setActiveSessionId } from '@/lib/chat/session-storage';

vi.mock('next/dynamic', () => ({ default: () => () => null }));

const proposal = {
  proposalId: 'proposal-home-A',
  summary: 'Họp đồng bộ trạng thái',
  description: 'Kiểm tra lịch trên web',
  attendees: [{ email: 'guest@example.com', name: 'Khách mời' }],
  startDateTime: '2026-11-22T09:00:00+07:00',
  endDateTime: '2026-11-22T10:00:00+07:00',
  timeZone: 'Asia/Ho_Chi_Minh',
  createMeet: false,
};

const event = {
  id: 'event-home-A',
  summary: proposal.summary,
  start: proposal.startDateTime,
  end: proposal.endDateTime,
  timeZone: proposal.timeZone,
  htmlLink: 'https://calendar.google.com/event?eid=home-a',
};

const modelCatalog = {
  defaultModel: 'openai/gpt-4o-mini',
  models: [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', isFree: true, supportsTools: true },
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', isFree: false, supportsTools: true },
  ],
};

function seedSessions() {
  const sessionB = createNewSession('openai/gpt-4o-mini', 'user_A');
  saveCurrentSession({
    ...sessionB,
    title: 'Hội thoại B',
    messages: [{ id: 'msg-b', role: 'user', content: 'Nội dung hội thoại B' }],
  }, 'user_A');

  const sessionA = createNewSession('openai/gpt-4o-mini', 'user_A');
  saveCurrentSession({
    ...sessionA,
    title: 'Hội thoại A',
    messages: [
      { id: 'msg-a-1', role: 'user', content: 'Đặt lịch họp đồng bộ' },
      {
        id: 'msg-a-2',
        role: 'assistant',
        content: '',
        toolInvocations: [{
          toolCallId: 'tool-home-A',
          toolName: 'proposeMeeting',
          state: 'result',
          args: {},
          result: proposal,
        }],
      },
    ],
  }, 'user_A');
  setActiveSessionId(sessionA.id, 'user_A');
  return { sessionA, sessionB };
}

function createFetchRouter(onConfirm: () => Promise<Response>) {
  let confirmCalls = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/google/status') {
      return Response.json({
        authenticated: true,
        isConfigured: true,
        user: { id: 'A', email: 'a@example.test', name: 'User A' },
      });
    }
    if (url === '/api/models') {
      return Response.json(modelCatalog);
    }
    if (url === '/api/chat') {
      return new Response('0:"Đã ghi nhận tin nhắn mới"\n', {
        headers: { 'Content-Type': 'text/plain', 'x-vercel-ai-data-stream': 'v1' },
      });
    }
    if (url === '/api/calendar/confirm') {
      confirmCalls += 1;
      return onConfirm();
    }
    if (url === '/api/auth/google/logout' && init?.method === 'POST') {
      return Response.json({ success: true });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  });
  return { fetchMock, getConfirmCalls: () => confirmCalls };
}

describe('Home pending confirmation sync across session switches', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('transitions reopened session A to created when confirmation resolves, and preserves it across messaging, model change, and reopen', async () => {
    const { sessionA } = seedSessions();
    let resolveConfirm!: (response: Response) => void;
    const { fetchMock, getConfirmCalls } = createFetchRouter(
      () => new Promise<Response>((resolve) => { resolveConfirm = resolve; }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const view = render(<Home />);
    const confirmBtn = await screen.findByRole('button', { name: /Xác nhận tạo lịch/ });
    fireEvent.click(confirmBtn);
    expect(getConfirmCalls()).toBe(1);

    // Switch to B and then reopen A before the confirmation resolves.
    fireEvent.click(screen.getByRole('button', { name: /^Hội thoại B/ }));
    expect(await screen.findByText('Nội dung hội thoại B', { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Hội thoại A/ }));
    expect(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ })).toBeInTheDocument();

    // Resolve the delayed confirmation response from the first instance.
    await act(async () => {
      resolveConfirm(Response.json({ success: true, event }));
    });

    expect(await screen.findByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xác nhận tạo lịch/ })).not.toBeInTheDocument();
    expect(getConfirmCalls()).toBe(1);

    // Send a new message in A, switch model, then switch away and reopen A.
    const input = screen.getByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(input, { target: { value: 'Cảm ơn trợ lý nhé' } });
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByText('Đã ghi nhận tin nhắn mới')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Chọn mô hình AI/ }));
    fireEvent.click(await screen.findByRole('option', { name: /GPT-4o •/ }));

    fireEvent.click(screen.getByRole('button', { name: /^Hội thoại B/ }));
    expect(await screen.findByText('Nội dung hội thoại B', { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Hội thoại A/ }));
    expect(await screen.findByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xác nhận tạo lịch/ })).not.toBeInTheDocument();

    view.unmount();
    const storedA = loadAllSessions('user_A').find((s) => s.id === sessionA.id);
    expect(storedA?.confirmedEvents[proposal.proposalId]).toEqual({ event });
    expect(storedA?.model).toBe('openai/gpt-4o');
  });

  it('preserves messages and model changes made in reopened A before confirmation resolves', async () => {
    const { sessionA } = seedSessions();
    let resolveConfirm!: (response: Response) => void;
    const { fetchMock, getConfirmCalls } = createFetchRouter(
      () => new Promise<Response>((resolve) => { resolveConfirm = resolve; }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Home />);
    fireEvent.click(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Hội thoại B/ }));
    expect(await screen.findByText('Nội dung hội thoại B', { selector: 'p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Hội thoại A/ }));
    expect(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ })).toBeInTheDocument();

    // Send a new message and switch model BEFORE confirmation finishes.
    const input = screen.getByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(input, { target: { value: 'Nhắn thêm trước khi hoàn tất' } });
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByText('Đã ghi nhận tin nhắn mới')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Chọn mô hình AI/ }));
    fireEvent.click(await screen.findByRole('option', { name: /GPT-4o •/ }));

    await act(async () => {
      resolveConfirm(Response.json({ success: true, event }));
    });

    expect(await screen.findByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
    expect(getConfirmCalls()).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /^Hội thoại B/ }));
    expect(await screen.findByText('Nội dung hội thoại B', { selector: 'p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Hội thoại A/ }));
    expect(await screen.findByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
    expect(screen.getByText('Đã ghi nhận tin nhắn mới')).toBeInTheDocument();

    const storedA = loadAllSessions('user_A').find((s) => s.id === sessionA.id);
    expect(storedA?.confirmedEvents[proposal.proposalId]).toEqual({ event });
    expect(storedA?.model).toBe('openai/gpt-4o');
  });

  it('keeps #27 behavior when staying on B or deleting A while confirmation is pending', async () => {
    const { sessionA, sessionB } = seedSessions();
    let resolveConfirm!: (response: Response) => void;
    const { fetchMock } = createFetchRouter(
      () => new Promise<Response>((resolve) => { resolveConfirm = resolve; }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Home />);
    fireEvent.click(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ }));

    // Switch to B and resolve while staying on B.
    fireEvent.click(screen.getByRole('button', { name: /^Hội thoại B/ }));
    expect(await screen.findByText('Nội dung hội thoại B', { selector: 'p' })).toBeInTheDocument();

    await act(async () => {
      resolveConfirm(Response.json({ success: true, event }));
    });

    expect(screen.queryByText('Đã tạo sự kiện thành công!')).not.toBeInTheDocument();
    expect(loadAllSessions('user_A').find((s) => s.id === sessionA.id)?.confirmedEvents[proposal.proposalId]).toEqual({ event });
    expect(loadAllSessions('user_A').find((s) => s.id === sessionB.id)?.confirmedEvents).toEqual({});

    // Reopen A -> created card is shown.
    fireEvent.click(screen.getByRole('button', { name: /^Hội thoại A/ }));
    expect(await screen.findByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
  });

  it('does not recreate deleted session A when its pending confirmation resolves', async () => {
    const { sessionA } = seedSessions();
    let resolveConfirm!: (response: Response) => void;
    const { fetchMock } = createFetchRouter(
      () => new Promise<Response>((resolve) => { resolveConfirm = resolve; }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Home />);
    fireEvent.click(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Hội thoại B/ }));
    expect(await screen.findByText('Nội dung hội thoại B', { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa phiên chat: Hội thoại A' }));
    await waitFor(() => {
      expect(loadAllSessions('user_A').find((s) => s.id === sessionA.id)).toBeUndefined();
    });

    await act(async () => {
      resolveConfirm(Response.json({ success: true, event }));
    });

    expect(loadAllSessions('user_A').find((s) => s.id === sessionA.id)).toBeUndefined();
    expect(screen.queryByText('Đã tạo sự kiện thành công!')).not.toBeInTheDocument();
  });
});
