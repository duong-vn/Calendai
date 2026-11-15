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
      return new Response(JSON.stringify({ authenticated: false, isConfigured: true }));
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
      return new Response(JSON.stringify({ authenticated: false, isConfigured: true }));
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
});
