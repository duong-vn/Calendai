import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpcomingEventCard } from '@/components/UpcomingEventCard';
import { UpcomingEventsModal } from '@/components/UpcomingEventsModal';
import type { UpcomingEventItem } from '@/lib/calendar/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('UpcomingEventCard external link validation', () => {
  const baseEvent: UpcomingEventItem = {
    id: 'evt-card',
    summary: 'Họp đối tác bên ngoài',
    start: '2026-11-24T09:00:00+07:00',
    end: '2026-11-24T10:00:00+07:00',
    isAllDay: false,
    htmlLink: 'https://calendar.google.com/calendar/event?eid=valid',
  };

  it.each([
    ['https://meet.google.com.evil.test/phish', 'https://calendar.google.com.evil.test/event'],
    ['https://user:pass@meet.google.com/abc-defg-hij', 'https://user:pass@calendar.google.com/calendar/event?eid=1'],
    ['http://meet.google.com/abc-defg-hij', 'http://calendar.google.com/calendar/event?eid=1'],
    ['javascript:alert(1)', 'javascript:alert(1)'],
  ])('does not render Meet or Calendar links for untrusted URLs (%s, %s)', (hangoutLink, htmlLink) => {
    render(<UpcomingEventCard event={{ ...baseEvent, hangoutLink, htmlLink }} />);

    expect(screen.getByText('Họp đối tác bên ngoài')).toBeInTheDocument();
    expect(screen.queryByText('Google Meet')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tham gia' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mở trên Google Calendar')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('renders Meet and Calendar links for verified Google domains', () => {
    render(
      <UpcomingEventCard
        event={{
          ...baseEvent,
          hangoutLink: 'https://meet.google.com/abc-defg-hij',
          htmlLink: 'https://www.google.com/calendar/event?eid=valid-www',
        }}
      />
    );

    expect(screen.getByText('Google Meet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tham gia' })).toHaveAttribute(
      'href',
      'https://meet.google.com/abc-defg-hij'
    );
    expect(screen.getByTitle('Mở trên Google Calendar')).toHaveAttribute(
      'href',
      'https://www.google.com/calendar/event?eid=valid-www'
    );
  });

  it.each([
    ['normalized zero-duration end === start', '2026-11-24T09:45:00+07:00'],
    ['same instant in UTC offset', '2026-11-24T02:45:00Z'],
    ['raw omitted empty end string', ''],
  ])('renders valid start time and omits empty/redundant end line in showDetails for %s', (_caseName, endValue) => {
    render(
      <UpcomingEventCard
        event={{
          id: 'zero-detail',
          summary: 'Nhắc nộp báo cáo',
          description: 'Gửi qua email',
          start: '2026-11-24T09:45:00+07:00',
          end: endValue,
          isAllDay: false,
          htmlLink: 'https://calendar.google.com/calendar/event?eid=zero',
        }}
        showDetails
      />
    );

    expect(screen.getByText('09:45 Thứ 3, 24/11')).toBeInTheDocument();
    expect(screen.getByText('Gửi qua email')).toBeInTheDocument();
    expect(screen.queryByText(/Kết thúc ·/)).not.toBeInTheDocument();
  });
});

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
        id: 'zero-milestone', summary: 'Mốc nhắc việc', description: 'Kiểm tra tiến độ',
        start: '2026-11-16T09:45:00+07:00', end: '2026-11-16T09:45:00+07:00', isAllDay: false, htmlLink: '',
      },
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
    const zeroEvent = within(monday).getByRole('button', { name: '09:45 Mốc nhắc việc' });
    fireEvent.click(zeroEvent);
    const details = screen.getByRole('region', { name: 'Chi tiết sự kiện' });
    expect(within(details).getByText('09:45 Thứ 2, 16/11')).toBeInTheDocument();
    expect(within(details).getByText('Kiểm tra tiến độ')).toBeInTheDocument();
    expect(within(details).queryByText(/Kết thúc ·/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết' }));

    const mondayEvent = within(monday).getByRole('button', { name: '23:30 Trực đêm' });
    expect(mondayEvent).toHaveStyle({ top: `${Number.parseFloat(monday.style.height) * 23.5 / 24}px` });
    expect(within(tuesday).getByRole('button', { name: '00:00 Trực đêm' })).toBeInTheDocument();
    fireEvent.click(mondayEvent);
    expect(screen.getByText('Bàn giao ca trực')).toBeInTheDocument();
    expect(screen.getByText('Kết thúc · 00:30 Thứ 3, 17/11')).toBeInTheDocument();
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
