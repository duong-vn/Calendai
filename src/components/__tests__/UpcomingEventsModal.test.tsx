import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpcomingEventsModal } from '@/components/UpcomingEventsModal';
import type { UpcomingEventItem } from '@/lib/calendar/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
