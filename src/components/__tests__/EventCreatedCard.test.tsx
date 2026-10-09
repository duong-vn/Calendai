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

  it('displays Mock Mode badge when created in mock mode', () => {
    render(<EventCreatedCard event={mockEvent} isMock={true} />);
    expect(screen.getByText('Mock Mode')).toBeInTheDocument();
  });
});
