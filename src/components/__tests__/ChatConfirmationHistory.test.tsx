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
  proposalId: 'proposal-A', summary: 'Họp dự án',
  startDateTime: '2026-11-14T09:00:00+07:00', endDateTime: '2026-11-14T10:00:00+07:00',
  timeZone: 'Asia/Ho_Chi_Minh', createMeet: false,
};
const event = {
  id: 'event-A', summary: proposal.summary, start: proposal.startDateTime, end: proposal.endDateTime,
  timeZone: proposal.timeZone, htmlLink: 'https://calendar.google.com/event?eid=fake',
};

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
});
