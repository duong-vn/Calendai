'use client';

import { useRef, useState } from 'react';
import type { MeetingProposalData } from './MeetingPreviewCard';

export interface CalendarConflict {
  id: string;
  summary: string;
  start: string;
  end: string;
  etag: string;
  timeZone: string;
  isAllDay: boolean;
}

const formatTime = (value: string, conflict: CalendarConflict) => new Date(value).toLocaleString('vi-VN', {
  timeZone: conflict.isAllDay ? conflict.timeZone : 'Asia/Ho_Chi_Minh',
  ...(conflict.isAllDay ? { year: 'numeric', month: '2-digit', day: '2-digit' } : {}),
});
const buttonClass = 'min-h-11 rounded-xl border-2 border-current px-3 py-2 text-xs font-semibold disabled:opacity-50';

export function isValidLocalDateTime(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return false;
  }
  const utcDate = new Date(0);
  utcDate.setUTCFullYear(year, month - 1, day);
  utcDate.setUTCHours(hour, minute, 0, 0);
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day &&
    utcDate.getUTCHours() === hour &&
    utcDate.getUTCMinutes() === minute
  );
}

function classifyResolveRejection(
  status: number,
  body: unknown,
  conflictId: string,
): { preWrite: boolean; message: string } {
  const record = typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
  const code = typeof record?.code === 'string' ? record.code : undefined;
  const serverError = typeof record?.error === 'string' ? record.error : undefined;

  if (status === 409 && code === 'CALENDAR_CONFLICT') {
    const overlaps = Array.isArray(record?.conflicts) ? record.conflicts : [];
    const overlapsDraft =
      overlaps.length === 1 &&
      typeof overlaps[0] === 'object' &&
      overlaps[0] !== null &&
      'id' in overlaps[0] &&
      overlaps[0].id === conflictId;
    return {
      preWrite: true,
      message: overlapsDraft
        ? 'Giờ mới vẫn trùng với bản thảo đang tạo. Vui lòng chọn khung giờ khác hoặc giữ lịch cũ.'
        : 'Giờ mới vẫn trùng với lịch hiện có hoặc bản thảo đang tạo. Vui lòng chọn khung giờ khác hoặc giữ lịch cũ.',
    };
  }

  if (status === 400) {
    const isRecurring = code === 'RECURRING_EVENT' || Boolean(serverError?.includes('chuỗi sự kiện'));
    return {
      preWrite: true,
      message: isRecurring
        ? 'Không thể thay đổi cả chuỗi sự kiện. Vui lòng chọn một lần diễn ra cụ thể.'
        : 'Ngày giờ hoặc thông tin thay đổi lịch không hợp lệ. Vui lòng kiểm tra lại.',
    };
  }

  if (status === 401 || (status === 403 && code === 'google_calendar_permission_required')) {
    return {
      preWrite: true,
      message:
        code === 'google_calendar_permission_required'
          ? 'Chưa đủ quyền Google Calendar. Vui lòng kết nối lại tài khoản Google và cấp quyền lịch.'
          : code === 'AUTH_REQUIRED'
            ? 'Vui lòng kết nối tài khoản Google để thay đổi lịch.'
            : 'Phiên đăng nhập Google đã hết hạn hoặc cần xác thực lại. Vui lòng kết nối lại tài khoản Google.',
    };
  }

  if (status === 409) {
    return {
      preWrite: false,
      message: 'Sự kiện đã thay đổi hoặc không còn trùng lịch. Vui lòng kiểm tra lại xung đột trước khi tiếp tục.',
    };
  }

  return {
    preWrite: false,
    message: 'Chưa cập nhật được lịch cũ. Vui lòng kiểm tra Google Calendar rồi thử lại.',
  };
}

export function CalendarConflictChoices({ proposal, conflicts, disabled = false, onResolved, onContinue }: {
  proposal: MeetingProposalData;
  conflicts: CalendarConflict[];
  disabled?: boolean;
  onResolved: () => void;
  onContinue: () => void;
}) {
  const [selection, setSelection] = useState<{ id: string; action: 'cancel' | 'reschedule' } | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  const resolve = async (conflict: CalendarConflict) => {
    if (pending.current || disabled || refreshRequired || !selection) return;
    if (selection.action === 'reschedule') {
      const trimmedStart = start.trim();
      const trimmedEnd = end.trim();
      if (!isValidLocalDateTime(trimmedStart) || !isValidLocalDateTime(trimmedEnd)) {
        setError('Ngày giờ không hợp lệ; vui lòng chọn ngày có thật và giờ từ 00:00 đến 23:59.');
        return;
      }
      if (trimmedEnd <= trimmedStart) {
        setError('Nhập thời gian hợp lệ; giờ kết thúc phải sau giờ bắt đầu.');
        return;
      }
    }
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const trimmedStart = start.trim();
      const trimmedEnd = end.trim();
      const response = await fetch('/api/calendar/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal, eventId: conflict.id, etag: conflict.etag, action: selection.action,
          ...(selection.action === 'reschedule' ? { startDateTime: `${trimmedStart}:00+07:00`, endDateTime: `${trimmedEnd}:00+07:00` } : {}),
        }),
      });
      if (!response.ok) {
        const body: unknown = typeof response.json === 'function' ? await response.json().catch(() => null) : null;
        const rejection = classifyResolveRejection(response.status, body, conflict.id);
        if (!rejection.preWrite) setRefreshRequired(true);
        setError(rejection.message);
        return;
      }
      setSelection(null);
      onResolved();
    } catch {
      setRefreshRequired(true);
      setError('Chưa cập nhật được lịch cũ. Vui lòng kiểm tra Google Calendar rồi thử lại.');
    } finally { pending.current = false; setBusy(false); }
  };

  return <section aria-label="Lịch bị xung đột" className="mt-3 space-y-3 rounded-xl border-2 border-[#d49439] bg-[#f5eee1] p-3 text-[#2b1f17] dark:bg-[#16120f] dark:text-[#f5ebd9]">
    <p role="status" className="text-sm font-bold">Khung giờ này trùng với lịch có sẵn. Bạn muốn xử lý thế nào?</p>
    <p className="text-xs">Lịch mới chưa được tạo. Hủy hoặc đổi giờ lịch cũ có thể gửi thông báo cho khách mời.</p>
    <ul className="space-y-3">
      {conflicts.map(conflict => <li key={conflict.id} className="space-y-2 border-t border-current/20 pt-3 [overflow-wrap:anywhere]">
        <p className="text-sm font-semibold">{conflict.summary}</p>
        <p className="text-xs">{formatTime(conflict.start, conflict)} → {formatTime(conflict.end, conflict)}{conflict.isAllDay ? ' · Cả ngày (ngày kết thúc không bao gồm)' : ' · GMT+7'}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={disabled || busy || refreshRequired} className={buttonClass} onClick={() => { setError(''); setSelection({ id: conflict.id, action: 'cancel' }); }}>Hủy lịch cũ</button>
          <button type="button" disabled={disabled || busy || refreshRequired} className={buttonClass} onClick={() => { setError(''); setSelection({ id: conflict.id, action: 'reschedule' }); }}>Đổi giờ lịch cũ</button>
        </div>
        {selection?.id === conflict.id && <div className="space-y-2">
          {selection.action === 'cancel' ? <p className="text-xs font-semibold">Xác nhận hủy “{conflict.summary}” trên Google Calendar? Lịch mới vẫn chưa được tạo.</p> : <div className="grid gap-2">
            <p className="text-xs">Nhập giờ mới cho lịch cũ (giờ Việt Nam, GMT+7). Chỉ đổi thời gian, giữ nguyên nội dung và khách mời.</p>
            <label className="grid gap-1 text-xs">Bắt đầu mới<input type="datetime-local" step="60" required value={start} onChange={event => setStart(event.target.value)} className="min-w-0 max-w-full rounded-lg border bg-transparent p-2 text-base" /></label>
            <label className="grid gap-1 text-xs">Kết thúc mới<input type="datetime-local" step="60" required value={end} onChange={event => setEnd(event.target.value)} className="min-w-0 max-w-full rounded-lg border bg-transparent p-2 text-base" /></label>
          </div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={disabled || busy || refreshRequired || (selection.action === 'reschedule' && (!start || !end || end <= start))} className={buttonClass} onClick={() => { void resolve(conflict); }}>{busy ? 'Đang cập nhật…' : selection.action === 'cancel' ? 'Xác nhận hủy lịch cũ' : 'Xác nhận đổi giờ lịch cũ'}</button>
            <button type="button" disabled={disabled || busy || refreshRequired} className={buttonClass} onClick={() => { setError(''); setSelection(null); }}>Quay lại</button>
          </div>
        </div>}
      </li>)}
    </ul>
    {!!error && <p role="alert" className="text-xs text-[#a63024] dark:text-[#f87171]">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={disabled || busy || refreshRequired} className={buttonClass} onClick={onContinue}>Vẫn tạo lịch mới, giữ lịch cũ</button>
      <button type="button" disabled={disabled || busy} className={buttonClass} onClick={onResolved}>Kiểm tra lại xung đột</button>
    </div>
  </section>;
}
