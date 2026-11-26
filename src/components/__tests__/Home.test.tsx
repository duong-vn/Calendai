import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { Message } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { createNewSession, getActiveSessionId, loadAllSessions, saveCurrentSession } from '@/lib/chat/session-storage';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/components/Header', () => ({
  Header: ({ onLogout, isAdmin }: { onLogout: () => void; isAdmin?: boolean }) => (
    <div>
      <button onClick={onLogout}>Đăng xuất</button>
      {isAdmin && <a href="/admin">Trang quản trị</a>}
    </div>
  ),
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
  const session = createNewSession(scope);
  saveCurrentSession({ ...session, title, messages: [{ id: title, role: 'user', content: title }] }, scope);
  return session.id;
}

function authResponse(id?: string, status = 200) {
  return Response.json({
    authenticated: Boolean(id), isConfigured: true,
    user: id ? { id, email: `${id}@example.test`, name: id } : null,
  }, { status });
}

function logoutOkResponse() {
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

function logoutErrorResponse() {
  return new Response(JSON.stringify({ success: false, error: 'Lỗi server' }), { status: 500 });
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
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (url.includes('/logout') && opts?.method === 'POST') return Promise.resolve(logoutOkResponse());
      return Promise.resolve(authResponse('A'));
    }));
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

describe('Home session status errors', () => {
  it.each([
    { name: 'HTTP 500', response: () => authResponse(undefined, 500) },
    { name: 'a network error', response: () => { throw new Error('Network error'); } },
    { name: 'malformed JSON', response: () => new Response('{') },
    {
      name: 'a non-boolean authenticated field',
      response: () => Response.json({ authenticated: 'false', user: null, isConfigured: true }),
    },
    {
      name: 'a guest status without a user field',
      response: () => Response.json({ authenticated: false, isConfigured: true }),
    },
    {
      name: 'an authenticated status without a user ID',
      response: () => Response.json({ authenticated: true, user: { email: 'a@example.test', name: 'A' }, isConfigured: true }),
    },
    {
      name: 'a guest status with a user profile',
      response: () => Response.json({ authenticated: false, user: { id: 'A', email: 'a@example.test', name: 'A' }, isConfigured: true }),
    },
  ])('keeps chat closed after $name and opens the resolved account on retry', async ({ response }) => {
    seed('guest', 'Nội dung khách');
    seed(undefined, 'Lịch sử dùng chung');
    const accountSession = seed('user_A', 'Nội dung tài khoản A');
    const guestHistory = loadAllSessions('guest');
    const legacyHistory = loadAllSessions();
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(async () => response())
      .mockResolvedValueOnce(authResponse('A')));

    await act(async () => { render(<Home />); });

    const composer = 'Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)';
    expect(screen.queryByPlaceholderText(composer)).not.toBeInTheDocument();
    expect(screen.queryByText('Nội dung khách')).not.toBeInTheDocument();
    expect(screen.queryByText('Nội dung tài khoản A')).not.toBeInTheDocument();
    expect(loadAllSessions('guest')).toEqual(guestHistory);
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể kiểm tra phiên đăng nhập.');

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByPlaceholderText(composer)).toBeInTheDocument();
    expect(await screen.findByText('Nội dung tài khoản A', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Nội dung khách')).not.toBeInTheDocument();
    expect(screen.queryByText('Lịch sử dùng chung')).not.toBeInTheDocument();
    expect(getActiveSessionId('user_A')).toBe(accountSession);
    expect(loadAllSessions('guest')).toEqual(guestHistory);
    expect(loadAllSessions()).toEqual(legacyHistory);
  });
});

describe('Home logout error handling', () => {
  it('stays authenticated and shows error toast when logout returns HTTP 500', async () => {
    seed('user_A', 'Nội dung tài khoản A');
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (url.includes('/logout') && opts?.method === 'POST') return Promise.resolve(logoutErrorResponse());
      return Promise.resolve(authResponse('A'));
    }));
    render(<Home />);
    await waitFor(() => expect(screen.getAllByText('Nội dung tài khoản A').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await waitFor(() => expect(screen.getByText('Ngắt kết nối thất bại. Vui lòng thử lại.')).toBeInTheDocument());
    // Still showing user content — not switched to guest
    expect(screen.getAllByText('Nội dung tài khoản A').length).toBeGreaterThan(0);
  });

  it('stays authenticated and shows error toast when fetch throws (network error)', async () => {
    seed('user_A', 'Nội dung tài khoản A');
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (url.includes('/logout') && opts?.method === 'POST') return Promise.reject(new Error('Network error'));
      return Promise.resolve(authResponse('A'));
    }));
    render(<Home />);
    await waitFor(() => expect(screen.getAllByText('Nội dung tài khoản A').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await waitFor(() => expect(screen.getByText('Ngắt kết nối thất bại. Vui lòng thử lại.')).toBeInTheDocument());
    expect(screen.getAllByText('Nội dung tài khoản A').length).toBeGreaterThan(0);
  });
});

describe('Home OAuth redirect feedback (auth_error)', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it.each([
    '/?auth_error=100%25',
    '/?auth_error=Google%20t%E1%BB%AB%20ch%E1%BB%91i%3A%20100%25',
    '/?auth_error=constructor',
    '/?auth_error=__proto__',
  ])('renders cleanly without URIError when URL is %s and shows safe Vietnamese fallback', async (urlWithError) => {
    window.history.replaceState({}, '', urlWithError);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(authResponse()));

    expect(() => render(<Home />)).not.toThrow();
    expect(
      await screen.findByText('Xác thực Google thất bại. Vui lòng thử lại sau.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('displays natural Vietnamese message for google_not_configured instead of raw code', async () => {
    window.history.replaceState({}, '', '/?auth_error=google_not_configured');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(authResponse()));

    render(<Home />);
    expect(
      await screen.findByText('Chức năng kết nối Google Calendar chưa được cấu hình trên máy chủ.')
    ).toBeInTheDocument();
    expect(screen.queryByText('google_not_configured')).not.toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('displays controlled Vietnamese GoogleOAuthError message from single-encoded or legacy double-encoded callback URL', async () => {
    const controlledMsg = 'Vui lòng cấp quyền quản lý sự kiện Google Calendar rồi đăng nhập lại.';
    const callbackUrl = new URL('http://localhost:3000/');
    callbackUrl.searchParams.set('auth_error', controlledMsg);
    window.history.replaceState({}, '', `${callbackUrl.pathname}${callbackUrl.search}`);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(authResponse()));

    const view = render(<Home />);
    expect(await screen.findByText(controlledMsg)).toBeInTheDocument();
    expect(window.location.search).toBe('');
    view.unmount();

    const legacyUrl = new URL('http://localhost:3000/');
    legacyUrl.searchParams.set('auth_error', encodeURIComponent(controlledMsg));
    window.history.replaceState({}, '', `${legacyUrl.pathname}${legacyUrl.search}`);
    render(<Home />);
    expect(await screen.findByText(controlledMsg)).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });
});

describe('Home admin link visibility', () => {
  it('checks /api/admin/config only when authenticated and shows admin link only for admin accounts', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/auth/google/status') {
        return authResponse('admin-1');
      }
      if (url === '/api/admin/config') {
        return Response.json({ isAdmin: true, primaryModel: 'm1', fallbackModel: null });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = render(<Home />);
    expect(await screen.findByRole('link', { name: 'Trang quản trị' })).toHaveAttribute('href', '/admin');
    view.unmount();

    // Non-admin receives 403 -> admin link stays hidden
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/auth/google/status') return authResponse('member-1');
        if (url === '/api/admin/config') return Response.json({ isAdmin: false }, { status: 403 });
        throw new Error(`Unexpected fetch URL: ${url}`);
      })
    );
    const memberView = render(<Home />);
    await screen.findByRole('button', { name: 'Đăng xuất' });
    expect(screen.queryByRole('link', { name: 'Trang quản trị' })).not.toBeInTheDocument();
    memberView.unmount();

    // Guest does not query /api/admin/config at all
    const guestFetch = vi.fn(async (url: string) => {
      if (url === '/api/auth/google/status') return authResponse();
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal('fetch', guestFetch);
    render(<Home />);
    await screen.findByRole('button', { name: 'Đăng xuất' });
    expect(guestFetch.mock.calls.some(([url]) => url === '/api/admin/config')).toBe(false);
    expect(screen.queryByRole('link', { name: 'Trang quản trị' })).not.toBeInTheDocument();
  });
});
