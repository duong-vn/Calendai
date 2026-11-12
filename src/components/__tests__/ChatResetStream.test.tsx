import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { getActiveSessionId, loadAllSessions } from '@/lib/chat/session-storage';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/components/Header', () => ({ Header: () => null }));

// Exercise the real AI SDK hook; only the HTTP stream and auth endpoint are local fixtures.
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe('Reset during an AI response', () => {
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
