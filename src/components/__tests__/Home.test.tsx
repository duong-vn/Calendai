import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { Message } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { createNewSession, getActiveSessionId, loadAllSessions, saveCurrentSession } from '@/lib/chat/session-storage';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/components/Header', () => ({
  Header: ({ onLogout }: { onLogout: () => void }) => <button onClick={onLogout}>Đăng xuất</button>,
}));
vi.mock('ai/react', () => ({
  useChat: () => {
    const [messages, setMessages] = useState<Message[]>([]);
    return {
      messages, setMessages, input: '', setInput: vi.fn(), handleInputChange: vi.fn(),
      handleSubmit: vi.fn(), isLoading: false, reload: vi.fn(),
    };
  },
}));

function seed(scope: string | undefined, title: string) {
  const session = createNewSession(undefined, scope);
  saveCurrentSession({ ...session, title, messages: [{ id: title, role: 'user', content: title }] }, scope);
  return session.id;
}

function authResponse(id?: string) {
  return new Response(JSON.stringify({
    authenticated: Boolean(id), isConfigured: true,
    user: id ? { id, email: `${id}@example.test`, name: id } : null,
  }));
}

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Home account-isolated history', () => {
  it('waits for identity, restores only that account, and never imports shared history', async () => {
    seed(undefined, 'Lịch sử dùng chung');
    seed('guest', 'Lịch sử khách');
    const activeA = seed('user_A', 'Nội dung tài khoản A');
    seed('user_B', 'Nội dung tài khoản B');
    let resolveStatus!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveStatus = resolve; })));

    render(<Home />);
    expect(screen.queryByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)')).not.toBeInTheDocument();
    expect(screen.queryByText('Lịch sử dùng chung')).not.toBeInTheDocument();
    await act(async () => resolveStatus(authResponse('A')));
    await waitFor(() => expect(screen.getAllByText('Nội dung tài khoản A').length).toBeGreaterThan(0));
    expect(screen.queryByText('Nội dung tài khoản B')).not.toBeInTheDocument();
    expect(screen.queryByText('Lịch sử khách')).not.toBeInTheDocument();
    expect(screen.queryByText('Lịch sử dùng chung')).not.toBeInTheDocument();
    expect(getActiveSessionId('user_A')).toBe(activeA);
    expect(loadAllSessions('user_A')).toHaveLength(1);
  });

  it('restores guest history on logout and B history on subsequent login without changing A', async () => {
    const activeA = seed('user_A', 'Nội dung tài khoản A');
    const activeB = seed('user_B', 'Nội dung tài khoản B');
    const guest = seed('guest', 'Nội dung khách');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(authResponse('A')));
    const view = render(<Home />);
    await waitFor(() => expect(screen.getAllByText('Nội dung tài khoản A').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await waitFor(() => expect(screen.getAllByText('Nội dung khách').length).toBeGreaterThan(0));
    expect(screen.queryByText('Nội dung tài khoản A')).not.toBeInTheDocument();
    expect(getActiveSessionId('user_A')).toBe(activeA);
    expect(getActiveSessionId('guest')).toBe(guest);

    view.unmount();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(authResponse('B')));
    render(<Home />);
    await waitFor(() => expect(screen.getAllByText('Nội dung tài khoản B').length).toBeGreaterThan(0));
    expect(screen.queryByText('Nội dung tài khoản A')).not.toBeInTheDocument();
    expect(screen.queryByText('Nội dung khách')).not.toBeInTheDocument();
    expect(getActiveSessionId('user_B')).toBe(activeB);
    expect(loadAllSessions('user_A')[0].messages[0].content).toBe('Nội dung tài khoản A');
    expect(loadAllSessions('user_B')).toHaveLength(1);
  });

  it('creates and deletes sessions only in the signed-in account', async () => {
    const activeB = seed('user_B', 'Nội dung tài khoản B');
    seed('user_A', 'Nội dung tài khoản A');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(authResponse('A')));
    render(<Home />);
    await waitFor(() => expect(screen.getAllByText('Nội dung tài khoản A').length).toBeGreaterThan(0));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Đoạn chat mới' })));
    expect(loadAllSessions('user_A')).toHaveLength(2);
    const newId = getActiveSessionId('user_A');
    expect(newId).not.toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Xóa phiên chat: Cuộc trò chuyện mới' })));
    expect(loadAllSessions('user_A')).toHaveLength(1);
    expect(getActiveSessionId('user_A')).not.toBe(newId);
    expect(loadAllSessions('user_B')).toHaveLength(1);
    expect(getActiveSessionId('user_B')).toBe(activeB);
    expect(loadAllSessions('guest')).toEqual([]);
    expect(loadAllSessions()).toEqual([]);
  });

  it('starts an account with no history empty instead of restoring shared proposals', async () => {
    seed(undefined, 'Đề xuất riêng của tài khoản cũ');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(authResponse('B')));
    render(<Home />);
    await screen.findByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    expect(screen.queryByText('Đề xuất riêng của tài khoản cũ')).not.toBeInTheDocument();
    expect(loadAllSessions('user_B')).toEqual([]);
  });
});
