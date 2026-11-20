import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { Message } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInterface } from '../ChatInterface';
import { createNewSession, deleteSessionById, getActiveSessionId, loadAllSessions, saveCurrentSession } from '@/lib/chat/session-storage';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('ai/react', () => ({
  useChat: () => {
    const [messages, setMessages] = useState<Message[]>([]);
    return { messages, setMessages, input: '', setInput: vi.fn(), handleInputChange: vi.fn(),
      handleSubmit: vi.fn(), isLoading: false, reload: vi.fn(), stop: vi.fn() };
  },
}));

const proposal = {
  proposalId: 'proposal-A', summary: 'Họp dự án', description: 'Trao đổi tiến độ',
  attendees: [{ email: 'guest@example.com', name: 'Khách mời' }],
  startDateTime: '2026-11-14T09:00:00+07:00', endDateTime: '2026-11-14T10:00:00+07:00',
  timeZone: 'Asia/Ho_Chi_Minh', createMeet: false,
};
const event = {
  id: 'event-A', summary: proposal.summary, start: proposal.startDateTime, end: proposal.endDateTime,
  timeZone: proposal.timeZone, htmlLink: 'https://calendar.google.com/event?eid=fake',
};
const conflict = { id: 'old', summary: 'Lịch đã có', start: proposal.startDateTime, end: proposal.endDateTime, etag: 'v1', timeZone: proposal.timeZone, isAllDay: false };
const calendarConflict = () => Response.json({ success: false, code: 'CALENDAR_CONFLICT', conflicts: [conflict] }, { status: 409 });
const authRequired = { success: false, code: 'AUTH_REQUIRED', error: 'Vui lòng kết nối lại tài khoản Google.' };

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function seedProposal(scope = 'user_A') {
  const session = createNewSession(undefined, scope);
  saveCurrentSession({ ...session, messages: [{ id: 'message-A', role: 'assistant', content: '', toolInvocations: [{
    toolCallId: 'tool-A', toolName: 'proposeMeeting', state: 'result', args: {}, result: proposal,
  }] }] }, scope);
  return session;
}

describe('Confirmation payload recovery', () => {
  it('does not send a mutation when saving the snapshot fails', async () => {
    const original = seedProposal();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    const button = await screen.findByRole('button', { name: /Xác nhận tạo lịch/ });
    const storage = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    fireEvent.click(button);
    expect(await screen.findByText('Không thể lưu bản xác nhận. Vui lòng kiểm tra bộ nhớ trình duyệt rồi thử lại.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Google Meet/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa' })).toBeEnabled();
    storage.mockRestore();
  });

  it('clears the rejected snapshot and unlocks editing after a calendar conflict, including on reload', async () => {
    const original = seedProposal();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(calendarConflict()));
    const view = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    fireEvent.click(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ }));
    await screen.findByText(conflict.summary);
    expect(screen.getByRole('button', { name: /Google Meet/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa' })).toBeEnabled();
    expect(loadAllSessions('user_A')[0].confirmationPayloads?.[proposal.proposalId]).toBeUndefined();

    view.unmount();
    render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    expect(await screen.findByRole('button', { name: /Google Meet/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa' })).toBeEnabled();
  });

  it.each([
    { status: 400, body: { success: false, error: 'Dữ liệu không hợp lệ.' } },
    { status: 401, body: authRequired },
  ])('unlocks after a first-attempt HTTP $status rejection before the write', async ({ status, body }) => {
    const original = seedProposal();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(body, { status })));
    render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    fireEvent.click(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ }));
    await screen.findByText(body.error);
    expect(screen.getByRole('button', { name: /Google Meet/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa' })).toBeEnabled();
    expect(loadAllSessions('user_A')[0].confirmationPayloads?.[proposal.proposalId]).toBeUndefined();
  });

  it('persists the edited conflict override before sending and retains it after a lost response', async () => {
    const original = seedProposal();
    let storedOverride: unknown;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(calendarConflict())
      .mockImplementationOnce(() => {
        storedOverride = loadAllSessions('user_A')[0].confirmationPayloads?.[proposal.proposalId];
        return Promise.reject(new Error('Mất kết nối'));
      })
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, event })));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    fireEvent.click(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ }));
    const overrideButton = await screen.findByRole('button', { name: 'Vẫn tạo lịch mới, giữ lịch cũ' });
    fireEvent.click(screen.getByRole('button', { name: /Google Meet/ }));
    fireEvent.click(overrideButton);
    await screen.findByText('Mất kết nối');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).allowConflict).toBe(false);
    expect(storedOverride).toMatchObject({ allowConflict: true, createMeet: true });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(storedOverride);
    view.unmount();
    render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    fireEvent.click(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ }));
    expect(await screen.findByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[1][1].body);
  });

  it('keeps the newer unresolved snapshot when a conflict arrives for an older attempt', async () => {
    const original = seedProposal();
    let resolve!: (response: Response) => void;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }))
      .mockRejectedValueOnce(new Error('Mất kết nối'));
    vi.stubGlobal('fetch', fetchMock);
    const chat = <ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />;
    const first = render(chat);
    fireEvent.click(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ }));
    first.unmount();

    const retry = render(chat);
    fireEvent.click(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ }));
    await screen.findByText('Mất kết nối');
    await act(async () => resolve(calendarConflict()));
    expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
    expect(loadAllSessions('user_A')[0].confirmationPayloads?.[proposal.proposalId]).toEqual(JSON.parse(fetchMock.mock.calls[1][1].body));

    retry.unmount();
    render(chat);
    expect(await screen.findByRole('button', { name: /Google Meet/ })).toBeDisabled();
  });

  it.each(['user_A', 'user_B', 'guest'])('isolates the same proposal ID from another session in %s', async (scope) => {
    const original = seedProposal();
    const other = seedProposal(scope);
    const fetchMock = vi.fn().mockRejectedValue(new Error('Mất kết nối'));
    vi.stubGlobal('fetch', fetchMock);
    let view = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    fireEvent.click(await screen.findByRole('button', { name: /Google Meet/ }));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận tạo lịch/ }));
    await screen.findByText('Mất kết nối');
    view.unmount();

    localStorage.setItem('calendai_reminder_minutes', '[15]');
    view = render(<ChatInterface isAuthenticated={scope !== 'guest'} historyScope={scope} activeSessionId={other.id} />);
    expect(await screen.findByRole('button', { name: /Google Meet \(Đang tắt\)/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận tạo lịch/ }));
    await screen.findByText('Mất kết nối');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ createMeet: false, reminderMinutes: [15] });
    view.unmount();
    render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    expect(await screen.findByRole('button', { name: /Google Meet \(Đang bật\)/ })).toBeDisabled();
    expect(screen.getByText('Nhắc qua Google Calendar: trước 60 và 10 phút (0 = lúc bắt đầu)')).toBeInTheDocument();
  });

  it.each([
    { failure: 'lost response' },
    { failure: 'HTTP 500', status: 500 },
    { failure: 'proposal ID conflict', status: 409, code: 'PROPOSAL_CONFLICT' },
  ])('persists and restores the exact locked payload after $failure', async ({ status, code }) => {
    const original = createNewSession(undefined, 'user_A');
    const messages: Message[] = [{ id: 'message-A', role: 'assistant', content: '', toolInvocations: [{
      toolCallId: 'tool-A', toolName: 'proposeMeeting', state: 'result', args: {}, result: proposal,
    }] }];
    saveCurrentSession({ ...original, messages }, 'user_A');
    localStorage.setItem('calendai_reminder_minutes', '[30,5]');
    let storedBeforeRequest = '';
    const fetchMock = vi.fn().mockImplementationOnce(() => {
      storedBeforeRequest = localStorage.getItem('calendai_user_A_chat_sessions') || '';
      return status
        ? Promise.resolve(Response.json({ success: false, error: 'Chưa xác định kết quả', code }, { status }))
        : Promise.reject(new Error('Chưa xác định kết quả'));
    }).mockResolvedValueOnce(Response.json(authRequired, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ success: true, event }));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    fireEvent.click(await screen.findByRole('button', { name: /Google Meet/ }));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận tạo lịch/ }));
    await screen.findByText('Chưa xác định kết quả');
    const firstBody = fetchMock.mock.calls[0][1].body;
    expect(storedBeforeRequest).toContain('"reminderMinutes":[30,5]');
    expect(screen.getByRole('button', { name: /Google Meet/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Google Meet/ }));
    view.unmount();

    localStorage.setItem('calendai_reminder_minutes', '[15]');
    saveCurrentSession({ ...loadAllSessions('user_A')[0], messages: [{ ...messages[0], toolInvocations: [{
      toolCallId: 'tool-A', toolName: 'proposeMeeting', state: 'result', args: {},
      result: { ...proposal, summary: 'Nội dung đã đổi', description: 'Không được dùng', attendees: [{ email: 'changed@example.com' }], startDateTime: '2026-12-01T12:00:00Z' },
    }] }] }, 'user_A');
    render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    expect(await screen.findByText(proposal.summary)).toBeInTheDocument();
    expect(screen.queryByText('Nội dung đã đổi')).not.toBeInTheDocument();
    expect(screen.getByText('Nhắc qua Google Calendar: trước 30 và 5 phút (0 = lúc bắt đầu)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Google Meet \(Đang bật\)/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận tạo lịch/ }));
    await screen.findByText(authRequired.error);
    expect(fetchMock.mock.calls[1][1].body).toBe(firstBody);
    expect(screen.getByRole('button', { name: /Google Meet/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận tạo lịch/ }));
    expect(await screen.findByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][1].body).toBe(firstBody);
  });
});

describe('Confirmation completing after chat unmount', () => {
  it.each(['switch', 'new', 'logout', 'delete'] as const)('preserves the originating history after %s without changing the active session', async (action) => {
    const original = createNewSession(undefined, 'user_A');
    saveCurrentSession({ ...original, messages: [{
      id: 'message-A', role: 'assistant', content: '', toolInvocations: [{
        toolCallId: 'tool-A', toolName: 'proposeMeeting', state: 'result', args: {}, result: proposal,
      }],
    }] }, 'user_A');
    const other = createNewSession(undefined, 'user_A');
    let resolve!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done; })));
    const view = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    fireEvent.click(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ }));
    view.unmount();

    const next = action === 'new' ? createNewSession(undefined, 'user_A') : other;
    if (action === 'delete') deleteSessionById(original.id, 'user_A');
    const scope = action === 'logout' ? 'guest' : 'user_A';
    render(<ChatInterface isAuthenticated={action !== 'logout'} historyScope={scope} activeSessionId={next.id} />);
    const activeBeforeResponse = getActiveSessionId(scope);
    await act(async () => resolve(new Response(JSON.stringify({ success: true, event }))));

    const stored = loadAllSessions('user_A').find(session => session.id === original.id);
    if (action === 'delete') {
      expect(stored).toBeUndefined();
    } else {
      expect(stored?.confirmedEvents[proposal.proposalId]).toEqual({ event });
      expect(stored?.messages).toHaveLength(1);
    }
    expect(getActiveSessionId(scope)).toBe(activeBeforeResponse);
    expect(loadAllSessions(scope).find(session => session.id === next.id)?.confirmedEvents ?? {}).toEqual({});
    expect(screen.queryByText('Đã tạo sự kiện thành công')).not.toBeInTheDocument();

    if (action !== 'delete') {
      cleanup();
      render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
      expect(await screen.findByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Xác nhận tạo lịch/ })).not.toBeInTheDocument();
    }
  });

  it('updates a reopened session in place when its pending confirmation resolves and preserves it across model changes', async () => {
    const original = seedProposal();
    const other = createNewSession(undefined, 'user_A');
    let resolve!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal('fetch', fetchMock);

    const viewA = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} selectedModel="model-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    viewA.unmount();

    const viewB = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={other.id} selectedModel="model-1" />);
    viewB.unmount();

    const reopenedA = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} selectedModel="model-1" />);
    expect(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ })).toBeInTheDocument();

    await act(async () => resolve(new Response(JSON.stringify({ success: true, event }))));

    expect(await screen.findByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xác nhận tạo lịch/ })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    reopenedA.rerender(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} selectedModel="model-2" />);
    reopenedA.unmount();

    render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} selectedModel="model-2" />);
    expect(await screen.findByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
    expect(loadAllSessions('user_A').find((s) => s.id === original.id)?.confirmedEvents[proposal.proposalId]).toEqual({ event });
  });

  it('preserves a model change made after reopening A before the pending confirmation resolves', async () => {
    const original = seedProposal();
    const other = createNewSession(undefined, 'user_A');
    let resolve!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal('fetch', fetchMock);

    const viewA = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} selectedModel="model-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ }));
    viewA.unmount();

    const viewB = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={other.id} selectedModel="model-1" />);
    viewB.unmount();

    const reopenedA = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} selectedModel="model-1" />);
    expect(await screen.findByRole('button', { name: /Xác nhận tạo lịch/ })).toBeInTheDocument();
    reopenedA.rerender(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} selectedModel="model-2" />);

    await act(async () => resolve(new Response(JSON.stringify({ success: true, event }))));

    expect(await screen.findByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    reopenedA.unmount();
    render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} selectedModel="model-2" />);
    expect(await screen.findByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
    const stored = loadAllSessions('user_A').find((s) => s.id === original.id);
    expect(stored?.confirmedEvents[proposal.proposalId]).toEqual({ event });
    expect(stored?.model).toBe('model-2');
  });

  it('unlocks a reopened session if its pending first-attempt confirmation is rejected before the write', async () => {
    const original = seedProposal();
    const other = createNewSession(undefined, 'user_A');
    let resolve!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal('fetch', fetchMock);

    const viewA = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    fireEvent.click(await screen.findByRole('button', { name: /Google Meet/ }));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận tạo lịch/ }));
    viewA.unmount();

    const viewB = render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={other.id} />);
    viewB.unmount();

    render(<ChatInterface isAuthenticated historyScope="user_A" activeSessionId={original.id} />);
    expect(await screen.findByRole('button', { name: /Google Meet/ })).toBeDisabled();

    await act(async () => resolve(calendarConflict()));

    expect(await screen.findByRole('button', { name: /Google Meet/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa' })).toBeEnabled();
    expect(loadAllSessions('user_A').find((s) => s.id === original.id)?.confirmationPayloads?.[proposal.proposalId]).toBeUndefined();
  });
});
