'use client';

import { useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  Clock,
  Edit3,
  Globe,
  Loader2,
  Users,
  Video,
} from 'lucide-react';
import type { CalendarEventResult } from '@/lib/calendar/types';
import { DEFAULT_REMINDER_MINUTES, readReminderSettings } from '@/lib/calendar/reminders';
import { CalendarConflictChoices, type CalendarConflict } from './CalendarConflictChoices';

export interface MeetingProposalData {
  proposalId: string;
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  attendees?: Array<{ email: string; name?: string }>;
  createMeet?: boolean;
  reminderMinutes?: number[];
}

interface MeetingPreviewCardProps {
  proposal: MeetingProposalData;
  onConfirmSuccess: (event: CalendarEventResult, isMock?: boolean) => void;
  onEditRequest?: () => void;
  compact?: boolean;
}

function formatVietnameseDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoString;
  }
}

function formatVietnameseTimeRange(startIso: string, endIso: string): string {
  try {
    const s = new Date(startIso);
    const e = new Date(endIso);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';

    const timeFmt = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const durationMin = Math.round((e.getTime() - s.getTime()) / (60 * 1000));
    return `${timeFmt.format(s)} – ${timeFmt.format(e)} (${durationMin} phút)`;
  } catch {
    return '';
  }
}

export function MeetingPreviewCard({
  proposal,
  onConfirmSuccess,
  onEditRequest,
  compact = false,
}: MeetingPreviewCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [createMeet, setCreateMeet] = useState(Boolean(proposal.createMeet));
  const confirmationPending = useRef(false);
  const submittedReminders = useRef<number[] | undefined>(undefined);
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);
  const [conflictRevision, setConflictRevision] = useState(0);
  const draft = { ...proposal, createMeet };

  const refreshConflicts = async () => {
    if (confirmationPending.current) return;
    confirmationPending.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/calendar/conflicts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.conflicts)) throw new Error('Chưa kiểm tra được lịch. Vui lòng thử lại.');
      setConflicts(data.conflicts);
      setConflictRevision(value => value + 1);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Chưa kiểm tra được lịch.');
    } finally { confirmationPending.current = false; setLoading(false); }
  };

  const handleConfirm = async (allowConflict = false) => {
    if (confirmationPending.current || isConfirmed) return;

    confirmationPending.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/calendar/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: proposal.summary,
          description: proposal.description,
          startDateTime: proposal.startDateTime,
          endDateTime: proposal.endDateTime,
          timeZone: proposal.timeZone || 'Asia/Ho_Chi_Minh',
          attendees: proposal.attendees || [],
          createMeet: Boolean(createMeet),
          proposalId: proposal.proposalId,
          allowConflict,
          reminderMinutes: submittedReminders.current ?? (submittedReminders.current = proposal.reminderMinutes ?? readReminderSettings()),
        }),
      });

      const data = await response.json();

      if (response.status === 409 && data.code === 'CALENDAR_CONFLICT' && Array.isArray(data.conflicts)) {
        setConflicts(data.conflicts);
        setConflictRevision(value => value + 1);
        return;
      }
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Tạo lịch thất bại. Vui lòng thử lại.');
      }

      setIsConfirmed(true);
      onConfirmSuccess(data.event, data.isMock);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tạo lịch.');
    } finally {
      confirmationPending.current = false;
      setLoading(false);
    }
  };

  const formattedDate = formatVietnameseDate(proposal.startDateTime);
  const formattedTimeRange = formatVietnameseTimeRange(
    proposal.startDateTime,
    proposal.endDateTime
  );

  return (
    <div className={compact ? 'min-w-0 [overflow-wrap:anywhere]' : 'my-3 overflow-hidden rounded-2xl border-2 border-[#2d2015] bg-[#fffaf2] shadow-[4px_4px_0px_#2d2015] transition-all dark:border-[#453427] dark:bg-[#1f1813] dark:shadow-[4px_4px_0px_#453427]'}>
      {/* Google Calendar Top Strip (Steam Chrono-Dispatch Ticket) */}
      <div className={compact ? 'flex flex-wrap items-center justify-between gap-2' : 'flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#2d2015] bg-[#ede4d5] px-4 py-2.5 sm:px-5 dark:border-[#453427] dark:bg-[#2b211a]'}>
        {!compact && <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2d2015] bg-[#c25e2e] text-white shadow-[1px_1px_0px_#2d2015] dark:bg-[#e07a3f] dark:border-[#453427]">
            <Calendar className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
            Google Calendar • Bản xem trước vé họp
          </span>
        </div>}
        <span className="rounded-md border border-[#2d2015] bg-[#fffaf2] px-2.5 py-0.5 text-[11px] font-mono font-bold text-[#d49439] uppercase tracking-wider dark:border-[#fbbf24]/40 dark:bg-[#211a14] dark:text-[#fbbf24]">
          Chờ xác nhận
        </span>
      </div>

      {/* Main Event Body */}
      <div className={compact ? 'pt-2' : 'p-4 sm:p-5'}>
        <div className="flex items-start gap-3">
          {/* Calendar accent bar */}
          <div className={compact ? 'hidden' : 'mt-1 h-10 w-1.5 rounded-full bg-[#c25e2e] shrink-0 dark:bg-[#e07a3f]'} />
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <h4 className="text-base font-bold text-[#2b1f17] sm:text-lg dark:text-[#f5ebd9]">
              {proposal.summary}
            </h4>
            {proposal.description && (
              <p className="mt-1 text-xs text-[#786455] sm:text-sm leading-relaxed dark:text-[#ba9f88]">
                {proposal.description}
              </p>
            )}
          </div>
        </div>

        {/* Details list */}
        <div className={compact ? 'mt-2 space-y-1.5' : 'mt-4 space-y-2.5 rounded-xl bg-[#f5eee1] p-3.5 border-2 border-[#2d2015]/20 dark:bg-[#16120f] dark:border-[#453427]'}>
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-[#2b1f17] dark:text-[#f5ebd9]">
            <Clock className="h-4 w-4 text-[#c25e2e] shrink-0 dark:text-[#e07a3f]" />
            <span>
              {formattedDate} • {formattedTimeRange}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-[#786455] dark:text-[#ba9f88]">
            <Globe className="h-4 w-4 text-[#786455] shrink-0 dark:text-[#ba9f88]" />
            <span>Múi giờ: {proposal.timeZone || 'Asia/Ho_Chi_Minh'} (GMT+7)</span>
          </div>

          {/* Attendees */}
          {proposal.attendees && proposal.attendees.length > 0 && (
            <div className="flex items-start gap-2.5 text-xs text-[#786455] dark:text-[#ba9f88]">
              <Users className="h-4 w-4 text-[#786455] shrink-0 mt-0.5 dark:text-[#ba9f88]" />
              <div className="min-w-0 flex flex-wrap gap-1.5">
                {proposal.attendees.map((attendee) => (
                  <span
                    key={attendee.email}
                    className="inline-flex max-w-full [overflow-wrap:anywhere] items-center rounded-full bg-[#fffaf2] px-2.5 py-0.5 text-xs font-mono font-medium text-[#2b1f17] border border-[#2d2015] dark:bg-[#211a14] dark:border-[#453427] dark:text-[#f5ebd9]"
                  >
                    {attendee.email}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Google Meet toggleable row */}
        <button
          type="button"
          onClick={() => !isConfirmed && !loading && setCreateMeet(!createMeet)}
          disabled={isConfirmed || loading}
          className={`mt-3 flex min-h-[44px] touch-manipulation flex-wrap gap-2 items-center justify-between w-full rounded-xl p-3 text-xs sm:text-sm border-2 transition-all text-left ${
            createMeet
              ? 'bg-[#f0f9f4] text-[#1f7560] border-[#2d2015] shadow-[2px_2px_0px_#2d2015] dark:bg-[#172b22] dark:text-[#2dd4bf] dark:border-[#453427]'
              : 'bg-[#f5eee1] text-[#786455] border-[#2d2015]/40 hover:bg-[#ede4d5] dark:bg-[#16120f] dark:text-[#ba9f88] dark:border-[#453427]'
          } ${isConfirmed || loading ? 'cursor-default' : 'cursor-pointer active:translate-x-[1px] active:translate-y-[1px]'}`}
          title="Bấm để bật hoặc tắt tạo link Google Meet"
        >
          <div className="flex items-center gap-2">
            <Video
              className={`h-4 w-4 shrink-0 ${
                createMeet ? 'text-[#1f7560] dark:text-[#2dd4bf]' : 'text-[#786455] dark:text-[#ba9f88]'
              }`}
            />
            <span className="font-bold">
              {createMeet ? 'Google Meet (Đang bật)' : 'Google Meet (Đang tắt)'}
            </span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold border ${
              createMeet
                ? 'bg-[#2d8a57] text-white border-[#2d2015] dark:bg-[#2dd4bf] dark:text-[#14110f] dark:border-[#453427]'
                : 'bg-[#ede4d5] text-[#786455] border-[#2d2015]/30 dark:bg-[#211a14] dark:text-[#ba9f88] dark:border-[#453427]'
            }`}
          >
            {createMeet ? 'Sẽ tạo link Meet' : 'Không tạo Meet'}
          </span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-[#786455] dark:text-[#ba9f88]">
          <Bell className="h-3.5 w-3.5 shrink-0" />
          <span>
            Nhắc qua Google Calendar:{' '}
            {(submittedReminders.current ?? proposal.reminderMinutes ?? readReminderSettings()).length
              ? `trước ${(submittedReminders.current ?? proposal.reminderMinutes ?? readReminderSettings()).join(' và ')} phút (0 = lúc bắt đầu)`
              : 'Đã tắt'}
          </span>
        </div>

        {conflicts.length > 0 && <CalendarConflictChoices key={conflictRevision} proposal={draft} conflicts={conflicts} disabled={loading} onResolved={() => { void refreshConflicts(); }} onContinue={() => { void handleConfirm(true); }} />}

        {/* Error notification */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#fdf2f0] p-3 text-xs text-[#a63024] border-2 border-[#cf3e32] shadow-[2px_2px_0px_#cf3e32] dark:border-[#ef4444] dark:bg-[#2b1614] dark:text-[#f87171]">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#cf3e32] mt-0.5" />
            <div>
              <span className="font-bold">Lỗi tạo lịch: </span>
              {error}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={compact ? 'mt-3 flex flex-wrap items-stretch justify-end gap-2 [&>button]:max-w-full [&>button]:px-3 [&>button]:sm:text-xs [&_svg]:shrink-0' : 'mt-5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 border-t-2 border-[#2d2015]/20 pt-4 dark:border-[#453427]'}>
          {onEditRequest && !isConfirmed && (
            <button
              type="button"
              onClick={onEditRequest}
              disabled={loading}
              className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-4 py-2 text-xs font-bold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] hover:bg-[#ede4d5] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none sm:text-sm disabled:opacity-50 dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427]"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Chỉnh sửa</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => { void handleConfirm(); }}
            disabled={loading || isConfirmed || conflicts.length > 0}
            className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-full border-2 border-[#2d2015] bg-[#c25e2e] px-5 py-2 text-xs font-bold text-white shadow-[3px_3px_0px_#2d2015] hover:bg-[#a6491e] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none sm:text-sm disabled:opacity-50 disabled:shadow-none dark:border-[#453427] dark:bg-[#e07a3f] dark:text-[#14110f] dark:shadow-[3px_3px_0px_#453427] dark:hover:bg-[#f59e0b]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang in vé lên Google Calendar...</span>
              </>
            ) : isConfirmed ? (
              <>
                <Check className="h-4 w-4" />
                <span>Đã đóng dấu tạo lịch</span>
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4" />
                <span>Xác nhận tạo lịch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
