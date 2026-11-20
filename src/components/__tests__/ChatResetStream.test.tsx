import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { createNewSession, getActiveSessionId, loadAllSessions, saveCurrentSession } from '@/lib/chat/session-storage';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/components/Header', () => ({ Header: () => null }));

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

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/chat') {
        if (!streamController) {
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
