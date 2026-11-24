import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEventResult } from '@/lib/calendar/types';
import { EventCreatedCard } from '../EventCreatedCard';

describe('EventCreatedCard Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockEvent: CalendarEventResult = {
    id: 'created-evt-123',
    summary: 'Họp Chiến Lược Q4',
    start: '2026-10-15T14:00:00+07:00',
    end: '2026-10-15T15:00:00+07:00',
    timeZone: 'Asia/Ho_Chi_Minh',
    htmlLink: 'https://calendar.google.com/calendar/event?eid=123',
    hangoutLink: 'https://meet.google.com/uvw-xyza-bcd',
    status: 'confirmed',
  };

  it('renders created event details with Google Meet link', () => {
    render(<EventCreatedCard event={mockEvent} isMock={false} />);

    expect(screen.getByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
    expect(screen.getByText('Họp Chiến Lược Q4')).toBeInTheDocument();
    expect(screen.getByText('https://meet.google.com/uvw-xyza-bcd')).toBeInTheDocument();
    expect(screen.getByText('Mở Google Calendar')).toBeInTheDocument();
  });

  it('copies Meet link to clipboard on button click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    render(<EventCreatedCard event={mockEvent} />);

    const copyBtn = screen.getByText('Sao chép');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalledWith('https://meet.google.com/uvw-xyza-bcd');
  });

  it('distinguishes a saved event from pending Google Meet creation', () => {
    render(<EventCreatedCard event={{ ...mockEvent, hangoutLink: undefined, conferenceStatus: 'pending' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Google Meet đang được tạo');
    expect(screen.queryByText('Vào phòng họp')).not.toBeInTheDocument();
  });

  it('reports Meet failure without claiming the Calendar event failed', () => {
    render(<EventCreatedCard event={{ ...mockEvent, hangoutLink: undefined, conferenceStatus: 'failure' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Sự kiện đã được lưu');
    expect(screen.getByText('Mở Google Calendar')).toBeInTheDocument();
  });

  it('displays Mock Mode badge when created in mock mode', () => {
    render(<EventCreatedCard event={mockEvent} isMock={true} />);
    expect(screen.getByText('Mock Mode')).toBeInTheDocument();
  });

  it.each([
    ['http://insecure.example/room', 'http://evil.example/cal'],
    ['javascript:alert(1)', 'javascript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>', 'data:text/html,cal'],
    ['https://meet.google.com.evil.test/room', 'https://calendar.google.com.evil.test/event'],
    ['https://user:pass@meet.google.com/uvw-xyza-bcd', 'https://user:pass@calendar.google.com/calendar/event?eid=123'],
  ])('omits Meet and Calendar links/copy actions for untrusted URLs (%s, %s)', (hangoutLink, htmlLink) => {
    render(<EventCreatedCard event={{ ...mockEvent, hangoutLink, htmlLink }} />);

    expect(screen.getByText('Đã tạo sự kiện thành công!')).toBeInTheDocument();
    expect(screen.getByText('Họp Chiến Lược Q4')).toBeInTheDocument();
    expect(screen.queryByText('Google Meet')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sao chép/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Vào phòng họp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Mở Google Calendar/i })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('accepts www.google.com calendar event URLs', () => {
    render(
      <EventCreatedCard
        event={{ ...mockEvent, htmlLink: 'https://www.google.com/calendar/event?eid=abc123' }}
      />
    );
    expect(screen.getByRole('link', { name: /Mở Google Calendar/i })).toHaveAttribute(
      'href',
      'https://www.google.com/calendar/event?eid=abc123'
    );
  });
});
