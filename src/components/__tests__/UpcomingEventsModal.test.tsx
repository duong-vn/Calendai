import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpcomingEventsModal } from '@/components/UpcomingEventsModal';
import type { UpcomingEventItem } from '@/lib/calendar/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('UpcomingEventsModal event dates', () => {
  it.each([
    ['2026-11-12', true, 'Cả ngày · Thứ 5, 12/11'],
    ['2026-12-31', true, 'Cả ngày · Thứ 5, 31/12'],
    ['2026-11-12T02:30:00Z', false, '09:30 Thứ 5, 12/11'],
  ])('formats %s (all-day: %s) without inventing a meeting time', async (start, isAllDay, expected) => {
    const event: UpcomingEventItem = {
      id: 'event', summary: 'Lịch kiểm thử', start, end: start, isAllDay,
      htmlLink: 'https://calendar.google.com/calendar/event?eid=fixture',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, events: [event] }))));

    render(<UpcomingEventsModal isOpen onClose={() => {}} />);

    expect(await screen.findByText(expected)).toBeInTheDocument();
    if (isAllDay) expect(screen.queryByText(/07:00/)).not.toBeInTheDocument();
  });
});

describe('Weekly calendar', () => {
  it.each([
    ['2026-11-15T16:59:00Z', '2026-11-09', 'Chủ Nhật · 15/11'],
    ['2026-11-15T17:01:00Z', '2026-11-16', 'Thứ Hai · 16/11'],
  ])('uses the Vietnam week at %s and marks today', async (now, monday, today) => {
    vi.setSystemTime(new Date(now));
    const fetchMock = vi.fn(async (_url: string) => Response.json({ success: true, events: [] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<UpcomingEventsModal isOpen onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lịch tuần' }));
    expect(await screen.findByText('Tuần này không có sự kiện.')).toBeInTheDocument();
    expect(fetchMock.mock.lastCall?.[0]).toBe(`/api/calendar/upcoming?week=${monday}`);
    expect(screen.getByText(today)).toHaveAttribute('aria-current', 'date');
    expect(screen.getByRole('region', { name: today })).toBeInTheDocument();
  });

  it('separates all-day events, splits overnights, opens details and navigates between weeks', async () => {
    vi.setSystemTime(new Date('2026-11-15T17:30:00Z'));
    const events: UpcomingEventItem[] = [
      { id: 'all-day', summary: 'Nghỉ phép', start: '2026-11-16', end: '2026-11-17', isAllDay: true, htmlLink: '' },
      {
        id: 'overnight', summary: 'Trực đêm', description: 'Bàn giao ca trực', start: '2026-11-16T23:30:00+07:00',
        end: '2026-11-17T00:30:00+07:00', isAllDay: false, htmlLink: '',
      },
    ];
    const fetchMock = vi.fn(async (url: string) => url.endsWith('2026-11-23')
      ? Response.json({ success: false, error: 'Không thể tải lịch kiểm thử.' }, { status: 500 })
      : Response.json({ success: true, events: url.endsWith('2026-11-16') ? events : [] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<UpcomingEventsModal isOpen onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lịch tuần' }));
    expect(await screen.findByRole('button', { name: 'Nghỉ phép' })).toBeInTheDocument();
    const monday = screen.getByRole('region', { name: 'Thứ Hai · 16/11' });
    const tuesday = screen.getByRole('region', { name: 'Thứ Ba · 17/11' });
    expect(within(monday).queryByText('Nghỉ phép')).not.toBeInTheDocument();
    const mondayEvent = within(monday).getByRole('button', { name: '23:30 Trực đêm' });
    expect(mondayEvent).toHaveStyle({ top: `${Number.parseFloat(monday.style.height) * 23.5 / 24}px` });
    expect(within(tuesday).getByRole('button', { name: '00:00 Trực đêm' })).toBeInTheDocument();
    fireEvent.click(mondayEvent);
    expect(screen.getByText('Bàn giao ca trực')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết' }));
    expect(mondayEvent).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Tuần trước' }));
    expect(await screen.findByText('Tuần này không có sự kiện.')).toBeInTheDocument();
    expect(fetchMock.mock.lastCall?.[0]).toBe('/api/calendar/upcoming?week=2026-11-09');
    fireEvent.click(screen.getByRole('button', { name: 'Tuần này' }));
    expect(await screen.findByRole('button', { name: 'Nghỉ phép' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tuần sau' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải lịch kiểm thử.');
    expect(screen.queryByText('Tuần này không có sự kiện.')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.lastCall?.[0]).toBe('/api/calendar/upcoming?week=2026-11-23'));
  });
});
