import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MeetingPreviewCard,
  type MeetingProposalData,
} from '../MeetingPreviewCard';

describe('MeetingPreviewCard Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockProposal: MeetingProposalData = {
    proposalId: 'prop-123',
    summary: 'Phỏng vấn Ứng viên Lead Dev',
    description: 'Thảo luận kinh nghiệm và mức đãi ngộ',
    startDateTime: '2026-10-14T09:00:00+07:00',
    endDateTime: '2026-10-14T10:00:00+07:00',
    timeZone: 'Asia/Ho_Chi_Minh',
    attendees: [{ email: 'candidate@example.com' }],
    createMeet: true,
  };

  it('renders proposal information accurately', () => {
    render(
      <MeetingPreviewCard
        proposal={mockProposal}
        onConfirmSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Phỏng vấn Ứng viên Lead Dev')).toBeInTheDocument();
    expect(screen.getByText('Thảo luận kinh nghiệm và mức đãi ngộ')).toBeInTheDocument();
    expect(screen.getByText('candidate@example.com')).toBeInTheDocument();
    expect(screen.getByText('Xác nhận tạo lịch')).toBeInTheDocument();
  });

  it('calls confirmation endpoint and handles success', async () => {
    const onConfirmSuccess = vi.fn();
    const mockCreatedEvent = {
      id: 'event-created-1',
      summary: 'Phỏng vấn Ứng viên Lead Dev',
      start: '2026-10-14T09:00:00+07:00',
      end: '2026-10-14T10:00:00+07:00',
      timeZone: 'Asia/Ho_Chi_Minh',
      htmlLink: 'https://calendar.google.com/...',
      hangoutLink: 'https://meet.google.com/abc-defg-hij',
      status: 'confirmed',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        event: mockCreatedEvent,
        isMock: false,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <MeetingPreviewCard
        proposal={mockProposal}
        onConfirmSuccess={onConfirmSuccess}
      />
    );

    const confirmBtn = screen.getByText('Xác nhận tạo lịch');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/calendar/confirm', expect.anything());
      expect(onConfirmSuccess).toHaveBeenCalledWith(mockCreatedEvent, false);
    });
  });

  it('displays error message when confirmation API fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Token đã hết hạn, vui lòng đăng nhập lại.',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <MeetingPreviewCard
        proposal={mockProposal}
        onConfirmSuccess={vi.fn()}
      />
    );

    const confirmBtn = screen.getByText('Xác nhận tạo lịch');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Token đã hết hạn, vui lòng đăng nhập lại.')
      ).toBeInTheDocument();
    });
  });
});
