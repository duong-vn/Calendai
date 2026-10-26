import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarConflictChoices } from '../CalendarConflictChoices';

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
});
