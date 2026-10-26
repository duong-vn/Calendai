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

  it('does not send duplicate confirmations while the first request is pending', () => {
    const mockFetch = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', mockFetch);
    render(<MeetingPreviewCard proposal={mockProposal} onConfirmSuccess={vi.fn()} />);
    const button = screen.getByText('Xác nhận tạo lịch');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).proposalId).toBe(mockProposal.proposalId);
  });

  it('asks about overlapping events before allowing an explicit override', async () => {
    const conflict = { id: 'old', summary: 'Lịch đã có', start: mockProposal.startDateTime, end: mockProposal.endDateTime, etag: 'v1', timeZone: 'Asia/Ho_Chi_Minh', isAllDay: false };
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ success: false, code: 'CALENDAR_CONFLICT', conflicts: [conflict] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, event: { id: 'created' } }) });
    vi.stubGlobal('fetch', mockFetch);
    const onConfirmSuccess = vi.fn();
    render(<MeetingPreviewCard proposal={mockProposal} onConfirmSuccess={onConfirmSuccess} />);
    fireEvent.click(screen.getByText('Xác nhận tạo lịch'));
    expect(await screen.findByText('Lịch đã có')).toBeInTheDocument();
    expect(onConfirmSuccess).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Vẫn tạo lịch mới, giữ lịch cũ' }));
    await waitFor(() => expect(onConfirmSuccess).toHaveBeenCalledOnce());
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).allowConflict).toBe(true);
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
