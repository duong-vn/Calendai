import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { createNewSession, getActiveSessionId, loadAllSessions, saveCurrentSession, setActiveSessionId } from '@/lib/chat/session-storage';

vi.mock('next/dynamic', () => ({ default: () => () => null }));

// Exercise the real AI SDK hook; only the HTTP stream and auth endpoint are local fixtures.
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe('Reset during an AI response', () => {
  it('does not recreate the reset conversation after deleting it and sending another message', async () => {
    const original = createNewSession(undefined, 'guest');
    original.messages = [{ id: 'original', role: 'user', content: 'Hội thoại ban đầu' }];
    saveCurrentSession(original, 'guest');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/chat') {
        return new Response('0:"Đã nhận yêu cầu"\n', {
          headers: { 'Content-Type': 'text/plain', 'x-vercel-ai-data-stream': 'v1' },
        });
      }
      return Response.json({ authenticated: false, user: null, isConfigured: true });
    }));

    render(<Home />);
    await screen.findByText('Hội thoại ban đầu', { selector: 'p' });
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới hội thoại' }));
    const resetId = getActiveSessionId('guest');
    expect(resetId).not.toBe(original.id);

    const input = screen.getByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(input, { target: { value: 'Tin nhắn phiên reset' } });
    fireEvent.submit(input.closest('form')!);
    await screen.findByText('Đã nhận yêu cầu');
    await waitFor(() => expect(loadAllSessions('guest').find((s) => s.id === resetId)?.title).toBe('Tin nhắn phiên reset'));

    fireEvent.click(screen.getByRole('button', { name: 'Xóa phiên chat: Tin nhắn phiên reset' }));
    await waitFor(() => expect(screen.queryByText('Tin nhắn phiên reset')).not.toBeInTheDocument());
    expect(getActiveSessionId('guest')).toBe(original.id);

    const restoredInput = screen.getByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(restoredInput, { target: { value: 'Tin nhắn sau khi xóa' } });
    fireEvent.submit(restoredInput.closest('form')!);
    await screen.findByText('Đã nhận yêu cầu');
    await waitFor(() => expect(loadAllSessions('guest').find((s) => s.id === original.id)?.messages)
      .toEqual(expect.arrayContaining([expect.objectContaining({ content: 'Tin nhắn sau khi xóa' })])));
    expect(loadAllSessions('guest').map((s) => s.id)).toEqual([original.id]);
    expect(getActiveSessionId('guest')).toBe(original.id);
  });

  it('keeps late chunks out of the new session and restores that empty session on reload', async () => {
    localStorage.clear();
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    let signal: AbortSignal | null | undefined;
    const encoder = new TextEncoder();
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/chat') {
        signal = init?.signal;
        return new Response(new ReadableStream<Uint8Array>({
          start(controller) { stream = controller; },
        }), { headers: { 'Content-Type': 'text/plain', 'x-vercel-ai-data-stream': 'v1' } });
      }
      return Response.json({ authenticated: false, user: null, isConfigured: true });
    }));

    const view = render(<Home />);
    const input = await screen.findByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(input, { target: { value: 'Họp sáng mai' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(stream).toBeDefined());
    await act(async () => { stream.enqueue(encoder.encode('0:"Phản hồi đang chạy"\n')); });
    await screen.findByText('Phản hồi đang chạy');
    const oldId = getActiveSessionId('guest');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Làm mới hội thoại' })); });
    const newId = getActiveSessionId('guest');
    await act(async () => {
      stream.enqueue(encoder.encode('0:" — nội dung đến trễ"\n'));
      stream.close();
    });

    expect(signal?.aborted).toBe(true);
    expect(newId).not.toBe(oldId);
    expect(screen.queryByText(/Phản hồi đang chạy/)).not.toBeInTheDocument();
    expect(loadAllSessions('guest').find((session) => session.id === newId)?.messages).toEqual([]);
    expect(loadAllSessions('guest').find((session) => session.id === oldId)?.messages.length).toBeGreaterThan(0);

    view.unmount();
    render(<Home />);
    await screen.findByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    expect(getActiveSessionId('guest')).toBe(newId);
    expect(screen.queryByText(/Phản hồi đang chạy/)).not.toBeInTheDocument();
  });

  it('clears the UI and does not resurrect the first conversation after deleting it from empty history', async () => {
    localStorage.clear();
    const encoder = new TextEncoder();
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let chatRequestCount = 0;

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/chat') {
        chatRequestCount += 1;
        if (chatRequestCount === 1) {
          return new Response(new ReadableStream<Uint8Array>({
            start(controller) { streamController = controller; },
          }), { headers: { 'Content-Type': 'text/plain', 'x-vercel-ai-data-stream': 'v1' } });
        }
        return new Response('0:"Phản hồi mới"\n', {
          headers: { 'Content-Type': 'text/plain', 'x-vercel-ai-data-stream': 'v1' },
        });
      }
      return Response.json({ authenticated: false, user: null, isConfigured: true });
    }));

    const view = render(<Home />);
    const input = await screen.findByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(input, { target: { value: 'Tin nhắn đầu tiên bị xóa' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(streamController).not.toBeNull());
    await act(async () => {
      streamController!.enqueue(encoder.encode('0:"Phần đầu"\n'));
    });
    await screen.findByText('Phần đầu');
    await act(async () => {
      streamController!.enqueue(encoder.encode('0:" và phần cuối"\n'));
      streamController!.close();
    });
    await screen.findByText('Phần đầu và phần cuối');

    const deletedId = getActiveSessionId('guest');
    expect(deletedId).not.toBeNull();
    await waitFor(() => expect(loadAllSessions('guest')).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'Xóa phiên chat: Tin nhắn đầu tiên bị xóa' }));

    await waitFor(() => {
      expect(screen.queryByText('Tin nhắn đầu tiên bị xóa', { selector: 'p' })).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Phần đầu và phần cuối')).not.toBeInTheDocument();
    expect(screen.getByText('Tôi có thể giúp bạn lên lịch cuộc họp nào hôm nay?')).toBeInTheDocument();
    expect(screen.getByText('Chưa có phiên chat nào.')).toBeInTheDocument();
    expect(loadAllSessions('guest')).toEqual([]);
    expect(getActiveSessionId('guest')).toBeNull();

    const nextInput = screen.getByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(nextInput, { target: { value: 'Tin nhắn mới sau khi xóa' } });
    fireEvent.submit(nextInput.closest('form')!);
    await screen.findByText('Phản hồi mới');

    await waitFor(() => expect(loadAllSessions('guest')).toHaveLength(1));
    const sessionsAfterNewSend = loadAllSessions('guest');
    expect(sessionsAfterNewSend[0].id).not.toBe(deletedId);
    expect(sessionsAfterNewSend[0].messages.map((m) => m.content)).toEqual([
      'Tin nhắn mới sau khi xóa',
      'Phản hồi mới',
    ]);

    view.unmount();
    render(<Home />);
    await screen.findByText('Phản hồi mới');
    expect(screen.queryByText('Tin nhắn đầu tiên bị xóa')).not.toBeInTheDocument();
    expect(screen.queryByText('Phần đầu và phần cuối')).not.toBeInTheDocument();
    expect(loadAllSessions('guest').map((s) => s.id)).toEqual([sessionsAfterNewSend[0].id]);
    expect(getActiveSessionId('guest')).toBe(sessionsAfterNewSend[0].id);
  });

  it('clears the UI when deleting the first conversation mid-stream and ignores late chunks', async () => {
    localStorage.clear();
    const encoder = new TextEncoder();
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let signal: AbortSignal | null | undefined;

    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/chat') {
        if (!streamController) {
          signal = init?.signal;
          return new Response(new ReadableStream<Uint8Array>({
            start(controller) { streamController = controller; },
          }), { headers: { 'Content-Type': 'text/plain', 'x-vercel-ai-data-stream': 'v1' } });
        }
        return new Response('0:"Phản hồi kế tiếp"\n', {
          headers: { 'Content-Type': 'text/plain', 'x-vercel-ai-data-stream': 'v1' },
        });
      }
      return Response.json({ authenticated: false, user: null, isConfigured: true });
    }));

    const view = render(<Home />);
    const input = await screen.findByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(input, { target: { value: 'Hội thoại xóa khi đang stream' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(streamController).not.toBeNull());
    await act(async () => {
      streamController!.enqueue(encoder.encode('0:"Đang trả lời"\n'));
    });
    await screen.findByText('Đang trả lời');
    const deletedId = getActiveSessionId('guest');
    expect(deletedId).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa phiên chat: Hội thoại xóa khi đang stream' }));
    await waitFor(() => {
      expect(screen.queryByText('Hội thoại xóa khi đang stream', { selector: 'p' })).not.toBeInTheDocument();
    });
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText('Đang trả lời')).not.toBeInTheDocument();
    expect(loadAllSessions('guest')).toEqual([]);

    await act(async () => {
      streamController!.enqueue(encoder.encode('0:" — đến trễ"\n'));
      streamController!.close();
    });

    expect(screen.queryByText(/Đang trả lời|đến trễ/)).not.toBeInTheDocument();
    expect(loadAllSessions('guest')).toEqual([]);
    expect(getActiveSessionId('guest')).toBeNull();

    const nextInput = screen.getByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(nextInput, { target: { value: 'Hội thoại sạch mới' } });
    fireEvent.submit(nextInput.closest('form')!);
    await screen.findByText('Phản hồi kế tiếp');

    view.unmount();
    render(<Home />);
    await screen.findByText('Phản hồi kế tiếp');
    expect(screen.queryByText('Hội thoại xóa khi đang stream')).not.toBeInTheDocument();
    const finalSessions = loadAllSessions('guest');
    expect(finalSessions).toHaveLength(1);
    expect(finalSessions[0].id).not.toBe(deletedId);
  });
});

describe('Abort active /api/chat stream on navigation, deletion, and logout', () => {
  it.each([
    { action: 'switch' as const, label: 'switching to another session from the sidebar' },
    { action: 'sidebar-new' as const, label: 'creating a new chat from the sidebar' },
    { action: 'header-refresh' as const, label: 'clicking refresh in the header' },
    { action: 'delete-active' as const, label: 'deleting the active streaming session' },
  ])('aborts /api/chat and isolates late chunks when $label', async ({ action }) => {
    const encoder = new TextEncoder();
    const sessionB = createNewSession(undefined, 'guest');
    saveCurrentSession({
      ...sessionB,
      title: 'Hội thoại B',
      messages: [{ id: 'msg-b', role: 'user', content: 'Nội dung hội thoại B' }],
    }, 'guest');

    const sessionA = createNewSession(undefined, 'guest');
    saveCurrentSession({
      ...sessionA,
      title: 'Hội thoại A',
      messages: [{ id: 'msg-a', role: 'user', content: 'Tin nhắn mở đầu A' }],
    }, 'guest');
    setActiveSessionId(sessionA.id, 'guest');

    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/chat') {
        signal = init?.signal;
        return new Response(new ReadableStream<Uint8Array>({
          start(controller) { streamController = controller; },
        }), { headers: { 'Content-Type': 'text/plain', 'x-vercel-ai-data-stream': 'v1' } });
      }
      return Response.json({ authenticated: false, user: null, isConfigured: true });
    }));

    const view = render(<Home />);
    const input = await screen.findByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(input, { target: { value: 'Đặt lịch lúc 10h' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(streamController).toBeDefined());
    expect(signal?.aborted).toBe(false);
    await act(async () => { streamController.enqueue(encoder.encode('0:"Phản hồi đang chạy"\n')); });
    await screen.findByText('Phản hồi đang chạy');

    if (action === 'switch') {
      fireEvent.click(screen.getByRole('button', { name: /^Hội thoại B/ }));
    } else if (action === 'sidebar-new') {
      fireEvent.click(screen.getByRole('button', { name: 'Đoạn chat mới' }));
    } else if (action === 'header-refresh') {
      fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Xóa session' }));
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Xóa phiên chat: Hội thoại A' }));
    }

    expect(signal?.aborted).toBe(true);

    await act(async () => {
      streamController.enqueue(encoder.encode('0:" — đoạn đến trễ"\n'));
      streamController.close();
    });

    expect(screen.queryByText(/Phản hồi đang chạy|đoạn đến trễ/)).not.toBeInTheDocument();
    const sessions = loadAllSessions('guest');
    if (action === 'delete-active') {
      expect(sessions.find((s) => s.id === sessionA.id)).toBeUndefined();
      expect(getActiveSessionId('guest')).toBe(sessionB.id);
    } else if (action === 'switch') {
      expect(getActiveSessionId('guest')).toBe(sessionB.id);
      expect(sessions.find((s) => s.id === sessionB.id)?.messages).toHaveLength(1);
    } else {
      const nextId = getActiveSessionId('guest');
      expect(nextId).not.toBe(sessionA.id);
      expect(nextId).not.toBe(sessionB.id);
      expect(sessions.find((s) => s.id === nextId)?.messages).toEqual([]);
    }

    view.unmount();
  });

  it('aborts /api/chat on logout, switches cleanly to guest, and handles AbortError without uncaught errors', async () => {
    const encoder = new TextEncoder();
    const sessionA = createNewSession(undefined, 'user_A');
    saveCurrentSession({
      ...sessionA,
      title: 'Phiên người dùng A',
      messages: [{ id: 'msg-a', role: 'user', content: 'Tin nhắn riêng tư' }],
    }, 'user_A');

    const guestSession = createNewSession(undefined, 'guest');
    saveCurrentSession({
      ...guestSession,
      title: 'Phiên khách',
      messages: [{ id: 'msg-g', role: 'user', content: 'Nội dung khách' }],
    }, 'guest');

    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    let signal: AbortSignal | null | undefined;
    let isLoggedIn = true;

    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/google/status') {
        return Response.json({
          authenticated: isLoggedIn,
          isConfigured: true,
          user: isLoggedIn ? { id: 'A', email: 'a@example.test', name: 'User A' } : null,
        });
      }
      if (url === '/api/auth/google/logout' && init?.method === 'POST') {
        isLoggedIn = false;
        return Response.json({ success: true });
      }
      if (url === '/api/chat') {
        signal = init?.signal;
        return new Response(new ReadableStream<Uint8Array>({
          start(controller) {
            streamController = controller;
            signal?.addEventListener('abort', () => {
              try {
                controller.error(new DOMException('The operation was aborted.', 'AbortError'));
              } catch {
                // Ignore if already closed
              }
            });
          },
        }), { headers: { 'Content-Type': 'text/plain', 'x-vercel-ai-data-stream': 'v1' } });
      }
      return Response.json({});
    }));

    const view = render(<Home />);
    const input = await screen.findByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(input, { target: { value: 'Xem lịch giúp tôi' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(streamController).toBeDefined());
    await act(async () => { streamController.enqueue(encoder.encode('0:"Đang tải lịch"\n')); });
    await screen.findByText('Đang tải lịch');
    expect(signal?.aborted).toBe(false);

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Đăng xuất' }));

    await waitFor(() => expect(screen.getByText('Nội dung khách', { selector: 'p' })).toBeInTheDocument());
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText(/Đang tải lịch/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chưa nhận được phản hồi/)).not.toBeInTheDocument();
    expect(loadAllSessions('guest').find((s) => s.id === guestSession.id)?.messages).toHaveLength(1);

    view.unmount();
  });

  it('does not abort the active stream when deleting an inactive session or when logout fails', async () => {
    const encoder = new TextEncoder();
    const sessionB = createNewSession(undefined, 'user_A');
    saveCurrentSession({
      ...sessionB,
      title: 'Hội thoại B',
      messages: [{ id: 'msg-b', role: 'user', content: 'Nội dung B' }],
    }, 'user_A');

    const sessionA = createNewSession(undefined, 'user_A');
    saveCurrentSession({
      ...sessionA,
      title: 'Hội thoại A',
      messages: [{ id: 'msg-a', role: 'user', content: 'Nội dung A' }],
    }, 'user_A');
    setActiveSessionId(sessionA.id, 'user_A');

    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/google/status') {
        return Response.json({
          authenticated: true,
          isConfigured: true,
          user: { id: 'A', email: 'a@example.test', name: 'User A' },
        });
      }
      if (url === '/api/auth/google/logout' && init?.method === 'POST') {
        return Response.json({ success: false }, { status: 500 });
      }
      if (url === '/api/chat') {
        signal = init?.signal;
        return new Response(new ReadableStream<Uint8Array>({
          start(controller) { streamController = controller; },
        }), { headers: { 'Content-Type': 'text/plain', 'x-vercel-ai-data-stream': 'v1' } });
      }
      return Response.json({});
    }));

    const view = render(<Home />);
    const input = await screen.findByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(input, { target: { value: 'Tiếp tục họp A' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(streamController).toBeDefined());
    await act(async () => { streamController.enqueue(encoder.encode('0:"Đang xử lý A"\n')); });
    await screen.findByText('Đang xử lý A');

    // Deleting inactive session B must not abort A's stream.
    fireEvent.click(screen.getByRole('button', { name: 'Xóa phiên chat: Hội thoại B' }));
    expect(signal?.aborted).toBe(false);

    // Failed logout must not abort A's stream.
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Đăng xuất' }));
    await screen.findByText('Ngắt kết nối thất bại. Vui lòng thử lại.');
    expect(signal?.aborted).toBe(false);

    await act(async () => {
      streamController.enqueue(encoder.encode('0:" — hoàn tất"\n'));
      streamController.close();
    });
    await screen.findByText('Đang xử lý A — hoàn tất');

    view.unmount();
  });

  it('aborts a pending /api/chat fetch before response headers arrive when switching sessions', async () => {
    const sessionB = createNewSession(undefined, 'guest');
    saveCurrentSession({
      ...sessionB,
      title: 'Hội thoại B',
      messages: [{ id: 'msg-b', role: 'user', content: 'Nội dung B' }],
    }, 'guest');

    const sessionA = createNewSession(undefined, 'guest');
    saveCurrentSession({
      ...sessionA,
      title: 'Hội thoại A',
      messages: [{ id: 'msg-a', role: 'user', content: 'Nội dung A' }],
    }, 'guest');
    setActiveSessionId(sessionA.id, 'guest');

    let signal: AbortSignal | null | undefined;
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/chat') {
        signal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      }
      return Promise.resolve(Response.json({ authenticated: false, user: null, isConfigured: true }));
    }));

    const view = render(<Home />);
    const input = await screen.findByPlaceholderText('Đặt lịch hẹn (VD: Họp dự án sáng mai 9h có Google Meet...)');
    fireEvent.change(input, { target: { value: 'Đợi AI phản hồi' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => expect(signal).toBeDefined());
    expect(signal?.aborted).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /^Hội thoại B/ }));
    expect(signal?.aborted).toBe(true);
    expect(await screen.findByText('Nội dung B', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByText(/Chưa nhận được phản hồi/)).not.toBeInTheDocument();

    view.unmount();
  });
});
