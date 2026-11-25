import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarConflictChoices, isValidLocalDateTime } from '../CalendarConflictChoices';
import { MeetingPreviewCard } from '../MeetingPreviewCard';

const proposal = { proposalId: 'new', summary: 'Họp mới', startDateTime: '2026-11-02T09:00:00+07:00', endDateTime: '2026-11-02T10:00:00+07:00' };
const conflict = { id: 'old', summary: 'Họp cũ', start: proposal.startDateTime, end: proposal.endDateTime, etag: 'version-1', timeZone: 'Asia/Ho_Chi_Minh', isAllDay: false };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Calendar conflict choices', () => {
  it('requires a second explicit confirmation before cancelling an existing event', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const onResolved = vi.fn();
    render(<CalendarConflictChoices proposal={proposal} conflicts={[conflict]} onResolved={onResolved} onContinue={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy lịch cũ' }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy lịch cũ' }));
    await waitFor(() => expect(onResolved).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ proposal, eventId: 'old', etag: 'version-1', action: 'cancel' });
  });

  it('allows keeping the old event without issuing a mutation', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const onContinue = vi.fn();
    render(<CalendarConflictChoices proposal={proposal} conflicts={[conflict]} onResolved={vi.fn()} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vẫn tạo lịch mới, giữ lịch cũ' }));
    expect(onContinue).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits replacement times in GMT+7 only after review', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<CalendarConflictChoices proposal={proposal} conflicts={[conflict]} onResolved={vi.fn()} onContinue={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đổi giờ lịch cũ' }));
    expect(screen.getByRole('button', { name: 'Xác nhận đổi giờ lịch cũ' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Bắt đầu mới'), { target: { value: '2026-11-02T14:00' } });
    fireEvent.change(screen.getByLabelText('Kết thúc mới'), { target: { value: '2026-11-02T15:00' } });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đổi giờ lịch cũ' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: 'reschedule', startDateTime: '2026-11-02T14:00:00+07:00', endDateTime: '2026-11-02T15:00:00+07:00' });
  });

  it('rejects impossible calendar dates and out-of-range hours on client before calling /api/calendar/resolve and keeps actions unlocked', () => {
    expect(isValidLocalDateTime('2026-02-30T14:00')).toBe(false);
    expect(isValidLocalDateTime('2026-02-29T14:00')).toBe(false);
    expect(isValidLocalDateTime('2028-02-29T14:00')).toBe(true);
    expect(isValidLocalDateTime('2026-04-31T14:00')).toBe(false);
    expect(isValidLocalDateTime('2026-11-02T24:00')).toBe(false);
    expect(isValidLocalDateTime('2026-11-02T14:60')).toBe(false);

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<CalendarConflictChoices proposal={proposal} conflicts={[conflict]} onResolved={vi.fn()} onContinue={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đổi giờ lịch cũ' }));
    fireEvent.change(screen.getByLabelText('Bắt đầu mới'), { target: { value: '2026-02-30T14:00' } });
    fireEvent.change(screen.getByLabelText('Kết thúc mới'), { target: { value: '2026-02-30T15:00' } });

    expect(screen.getByRole('button', { name: 'Xác nhận đổi giờ lịch cũ' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Vẫn tạo lịch mới, giữ lịch cũ' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeEnabled();
  });

  it('keeps inputs and all actions unlocked on 409 CALENDAR_CONFLICT so user can adjust times or keep old event without remounting', async () => {
    const thirdConflict = { ...conflict, id: 'third', summary: 'Họp khách hàng' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ success: false, code: 'CALENDAR_CONFLICT', conflicts: [conflict] }, { status: 409 }))
      .mockResolvedValueOnce(Response.json(
        { success: false, code: 'CALENDAR_CONFLICT', conflicts: [thirdConflict], error: 'private-google-detail' },
        { status: 409 }
      ))
      .mockResolvedValueOnce(Response.json({ success: true }, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ success: true, conflicts: [] }, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<MeetingPreviewCard proposal={proposal} onConfirmSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạo lịch' }));
    await screen.findByText('Họp cũ');

    fireEvent.click(screen.getByRole('button', { name: 'Đổi giờ lịch cũ' }));
    fireEvent.change(screen.getByLabelText('Bắt đầu mới'), { target: { value: '2026-11-02T14:00' } });
    fireEvent.change(screen.getByLabelText('Kết thúc mới'), { target: { value: '2026-11-02T15:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đổi giờ lịch cũ' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/trùng với lịch hiện có|trùng với bản thảo/);
    expect(alert.textContent).not.toContain('private-google-detail');
    expect(screen.getByLabelText('Bắt đầu mới')).toHaveValue('2026-11-02T14:00');
    expect(screen.getByLabelText('Kết thúc mới')).toHaveValue('2026-11-02T15:00');
    expect(screen.getByRole('button', { name: 'Xác nhận đổi giờ lịch cũ' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hủy lịch cũ' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Đổi giờ lịch cũ' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Vẫn tạo lịch mới, giữ lịch cũ' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Bắt đầu mới'), { target: { value: '2026-11-02T16:00' } });
    fireEvent.change(screen.getByLabelText('Kết thúc mới'), { target: { value: '2026-11-02T17:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đổi giờ lịch cũ' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
      action: 'reschedule',
      startDateTime: '2026-11-02T16:00:00+07:00',
      endDateTime: '2026-11-02T17:00:00+07:00',
    });
  });

  it.each([
    {
      label: '400 recurring series',
      status: 400,
      body: { success: false, error: 'Không thể thay đổi cả chuỗi sự kiện. Vui lòng chọn một lần diễn ra cụ thể.' },
      expectedPattern: /Không thể thay đổi cả chuỗi sự kiện/,
    },
    {
      label: '400 invalid date/input with raw diagnostic',
      status: 400,
      body: { success: false, error: 'Invalid Google field diagnostic token-xyz' },
      expectedPattern: /không hợp lệ/i,
    },
    {
      label: '401 expired Google session',
      status: 401,
      body: { code: 'google_reauthorization_required', error: 'Invalid Credentials raw-token' },
      expectedPattern: /kết nối lại tài khoản Google|đăng nhập/i,
    },
    {
      label: '403 missing Calendar permission',
      status: 403,
      body: { success: false, code: 'google_calendar_permission_required', error: 'insufficientPermissions raw' },
      expectedPattern: /quyền Google Calendar/i,
    },
  ])('does not set refreshRequired on pre-write rejection ($label), sanitizes message, and still allows keeping old event', async ({ status, body, expectedPattern }) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(body, { status }));
    vi.stubGlobal('fetch', fetchMock);
    const onContinue = vi.fn();

    render(<CalendarConflictChoices proposal={proposal} conflicts={[conflict]} onResolved={vi.fn()} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy lịch cũ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy lịch cũ' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(expectedPattern);
    expect(alert.textContent).not.toContain('token-xyz');
    expect(alert.textContent).not.toContain('raw-token');
    expect(alert.textContent).not.toContain('insufficientPermissions');

    expect(screen.getByRole('button', { name: 'Xác nhận hủy lịch cũ' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hủy lịch cũ' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Đổi giờ lịch cũ' })).toBeEnabled();
    const keepButton = screen.getByRole('button', { name: 'Vẫn tạo lịch mới, giữ lịch cũ' });
    expect(keepButton).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(keepButton);
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it.each([
    {
      label: '409 STALE_EVENT',
      mockResponse: () => Promise.resolve(Response.json({ success: false, code: 'STALE_EVENT', error: 'Sự kiện đã thay đổi.' }, { status: 409 })),
      expectedPattern: /đã thay đổi hoặc không còn trùng lịch/,
    },
    {
      label: '502 uncertain provider failure',
      mockResponse: () => Promise.resolve(Response.json({ success: false, error: 'Upstream 502 raw detail' }, { status: 502 })),
      expectedPattern: /Chưa cập nhật được lịch cũ/,
    },
    {
      label: 'network failure',
      mockResponse: () => Promise.reject(new Error('Failed to fetch')),
      expectedPattern: /Chưa cập nhật được lịch cũ/,
    },
  ])('locks conflict actions with refreshRequired on $label while keeping "Kiểm tra lại xung đột" enabled', async ({ mockResponse, expectedPattern }) => {
    const fetchMock = vi.fn().mockImplementationOnce(mockResponse);
    vi.stubGlobal('fetch', fetchMock);
    const onResolved = vi.fn();

    render(<CalendarConflictChoices proposal={proposal} conflicts={[conflict]} onResolved={onResolved} onContinue={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy lịch cũ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy lịch cũ' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(expectedPattern);
    expect(alert.textContent).not.toContain('Upstream 502 raw detail');

    expect(screen.getByRole('button', { name: 'Xác nhận hủy lịch cũ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hủy lịch cũ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đổi giờ lịch cũ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Vẫn tạo lịch mới, giữ lịch cũ' })).toBeDisabled();

    const refreshButton = screen.getByRole('button', { name: 'Kiểm tra lại xung đột' });
    expect(refreshButton).toBeEnabled();
    fireEvent.click(refreshButton);
    expect(onResolved).toHaveBeenCalledOnce();
  });
});

