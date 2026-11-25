import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReminderSettings } from '../ReminderSettings';
import {
  MeetingPreviewCard,
  type MeetingProposalData,
} from '../MeetingPreviewCard';

describe('MeetingPreviewCard Component', () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.removeItem('calendai_reminder_minutes');
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

  it('uses two default reminders when no preference exists', async () => {
    localStorage.removeItem('calendai_reminder_minutes');
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, event: { id: 'created' } }) });
    vi.stubGlobal('fetch', mockFetch);
    render(<MeetingPreviewCard proposal={mockProposal} onConfirmSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('Xác nhận tạo lịch'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).reminderMinutes).toEqual([60, 10]);
  });

  it.each([undefined, [15]])('keeps the preview and confirmation aligned after saving settings (proposal reminders: %j)', async (reminderMinutes) => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, event: { id: 'created' } }) });
    vi.stubGlobal('fetch', mockFetch);
    render(<><ReminderSettings /><MeetingPreviewCard proposal={{ ...mockProposal, reminderMinutes }} onConfirmSuccess={vi.fn()} /></>);
    expect(screen.getByText(`Nhắc qua Google Calendar: trước ${reminderMinutes ? '15' : '60 và 10'} phút (0 = lúc bắt đầu)`)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cài đặt'));
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ mốc nhắc 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ mốc nhắc 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    expect(screen.getByText(reminderMinutes ? 'Nhắc qua Google Calendar: trước 15 phút (0 = lúc bắt đầu)' : 'Nhắc qua Google Calendar: Đã tắt')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Xác nhận tạo lịch'));
    await screen.findByText('Đã đóng dấu tạo lịch');
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).reminderMinutes).toEqual(reminderMinutes ?? []);
  });

  it('uses saved reminder settings and keeps them fixed for retries', async () => {
    localStorage.setItem('calendai_reminder_minutes', '[30,5]');
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ success: false, error: 'Thử lại' }) });
    vi.stubGlobal('fetch', mockFetch);
    render(<><ReminderSettings /><MeetingPreviewCard proposal={mockProposal} onConfirmSuccess={vi.fn()} /></>);
    fireEvent.click(screen.getByText('Xác nhận tạo lịch'));
    await screen.findByText('Thử lại');
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).reminderMinutes).toEqual([30, 5]);
    fireEvent.click(screen.getByText('Cài đặt'));
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ mốc nhắc 2' }));
    fireEvent.change(screen.getByLabelText('Nhắc trước (phút) 1'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    expect(localStorage.getItem('calendai_reminder_minutes')).toBe('[15]');
    expect(screen.getByText('Nhắc qua Google Calendar: trước 30 và 5 phút (0 = lúc bắt đầu)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Xác nhận tạo lịch'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).reminderMinutes).toEqual([30, 5]);
    localStorage.removeItem('calendai_reminder_minutes');
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

  it('unlocks Meet toggle, edit button, and reminders on first-attempt 403 google_calendar_permission_required, while keeping locked on uncertain 403/500', async () => {
    localStorage.setItem('calendai_reminder_minutes', '[60,10]');
    const discard = vi.fn(() => true);
    const onSubmitPayload = vi.fn(() => discard);
    const onEditRequest = vi.fn();
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(Response.json({
        success: false,
        code: 'google_calendar_permission_required',
        error: 'Chưa đủ quyền quản lý sự kiện Google Calendar. Vui lòng kết nối lại tài khoản Google và cấp quyền.',
      }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({
        success: true,
        event: { id: 'created-after-regrant' },
        isMock: false,
      }));
    vi.stubGlobal('fetch', mockFetch);

    render(
      <>
        <ReminderSettings />
        <MeetingPreviewCard
          proposal={mockProposal}
          onSubmitPayload={onSubmitPayload}
          onEditRequest={onEditRequest}
          onConfirmSuccess={vi.fn()}
        />
      </>
    );

    fireEvent.click(screen.getByText('Xác nhận tạo lịch'));
    expect(
      await screen.findByText('Chưa đủ quyền quản lý sự kiện Google Calendar. Vui lòng kết nối lại tài khoản Google và cấp quyền.')
    ).toBeInTheDocument();

    expect(discard).toHaveBeenCalledOnce();
    const meetButton = screen.getByRole('button', { name: /Google Meet/ });
    const editButton = screen.getByRole('button', { name: 'Chỉnh sửa' });
    expect(meetButton).toBeEnabled();
    expect(editButton).toBeEnabled();

    fireEvent.click(meetButton);
    fireEvent.click(screen.getByText('Cài đặt'));
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ mốc nhắc 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));

    fireEvent.click(screen.getByText('Xác nhận tạo lịch'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toMatchObject({
      createMeet: false,
      reminderMinutes: [60],
    });
  });

  it('displays the DST offset at the meeting start time for a July America/New_York proposal viewed in January and preserves confirmation payload', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        event: { id: 'created-ny-summer' },
        isMock: false,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <MeetingPreviewCard
        proposal={{
          ...mockProposal,
          proposalId: 'prop-ny-summer',
          startDateTime: '2026-07-15T13:00:00Z',
          endDateTime: '2026-07-15T14:00:00Z',
          timeZone: 'America/New_York',
        }}
        onConfirmSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/09:00 – 10:00 \(60 phút\)/)).toBeInTheDocument();
    expect(screen.getByText('Múi giờ: America/New_York (GMT-4)')).toBeInTheDocument();
    expect(screen.queryByText(/GMT-5/)).toBeNull();

    fireEvent.click(screen.getByText('Xác nhận tạo lịch'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({
      startDateTime: '2026-07-15T13:00:00Z',
      endDateTime: '2026-07-15T14:00:00Z',
      timeZone: 'America/New_York',
    });
  });

  it('displays the standard offset at the meeting start time for a January America/New_York proposal viewed in July and preserves confirmation payload', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        event: { id: 'created-ny-winter' },
        isMock: false,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <MeetingPreviewCard
        proposal={{
          ...mockProposal,
          proposalId: 'prop-ny-winter',
          startDateTime: '2026-01-15T14:00:00Z',
          endDateTime: '2026-01-15T15:00:00Z',
          timeZone: 'America/New_York',
        }}
        onConfirmSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/09:00 – 10:00 \(60 phút\)/)).toBeInTheDocument();
    expect(screen.getByText('Múi giờ: America/New_York (GMT-5)')).toBeInTheDocument();
    expect(screen.queryByText(/GMT-4/)).toBeNull();

    fireEvent.click(screen.getByText('Xác nhận tạo lịch'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({
      startDateTime: '2026-01-15T14:00:00Z',
      endDateTime: '2026-01-15T15:00:00Z',
      timeZone: 'America/New_York',
    });
  });

  it('keeps Asia/Ho_Chi_Minh at GMT+7 and preserves confirmation payload', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        event: { id: 'created-vn' },
        isMock: false,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <MeetingPreviewCard
        proposal={mockProposal}
        onConfirmSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/09:00 – 10:00 \(60 phút\)/)).toBeInTheDocument();
    expect(screen.getByText('Múi giờ: Asia/Ho_Chi_Minh (GMT+7)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Xác nhận tạo lịch'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({
      startDateTime: '2026-10-14T09:00:00+07:00',
      endDateTime: '2026-10-14T10:00:00+07:00',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  });

  it('omits the GMT offset instead of falling back to today when startDateTime is invalid', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

    render(
      <MeetingPreviewCard
        proposal={{
          ...mockProposal,
          proposalId: 'prop-invalid-date',
          startDateTime: 'invalid-date',
          timeZone: 'America/New_York',
        }}
        onConfirmSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Múi giờ: America/New_York')).toBeInTheDocument();
    expect(screen.queryByText(/GMT/)).toBeNull();
  });
});
