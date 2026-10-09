'use client';

import { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Globe,
  Loader2,
  Users,
  Video,
} from 'lucide-react';
import type { CalendarEventResult } from '@/lib/calendar/types';

export interface MeetingProposalData {
  proposalId: string;
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  attendees?: Array<{ email: string; name?: string }>;
  createMeet?: boolean;
}

interface MeetingPreviewCardProps {
  proposal: MeetingProposalData;
  onConfirmSuccess: (event: CalendarEventResult, isMock?: boolean) => void;
  onEditRequest?: () => void;
}

function formatVietnameseDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const formatter = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return formatter.format(d);
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
}: MeetingPreviewCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleConfirm = async () => {
    if (loading || isConfirmed) return;

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
          createMeet: proposal.createMeet !== false,
          proposalId: proposal.proposalId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Tạo lịch thất bại. Vui lòng thử lại.');
      }

      setIsConfirmed(true);
      onConfirmSuccess(data.event, data.isMock);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tạo lịch.');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = formatVietnameseDate(proposal.startDateTime);
  const formattedTimeRange = formatVietnameseTimeRange(
    proposal.startDateTime,
    proposal.endDateTime
  );

  return (
    <div className="my-3 overflow-hidden rounded-2xl border-2 border-blue-200 bg-white shadow-md transition-all">
      {/* Header card */}
      <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/60 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
            Xác Nhận Lịch Hẹn
          </span>
        </div>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
          Chờ xác nhận
        </span>
      </div>

      {/* Body details */}
      <div className="space-y-3.5 p-4 sm:p-5">
        <div>
          <h4 className="text-base font-bold text-slate-900 sm:text-lg">
            {proposal.summary}
          </h4>
          {proposal.description && (
            <p className="mt-1 text-xs text-slate-600 leading-relaxed sm:text-sm">
              {proposal.description}
            </p>
          )}
        </div>

        {/* Time highlight box */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:p-3.5 space-y-2">
          <div className="flex items-center gap-2.5 text-xs text-slate-800 sm:text-sm font-medium">
            <Clock className="h-4 w-4 shrink-0 text-blue-600" />
            <span>
              {formattedDate} | {formattedTimeRange}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-500">
            <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{proposal.timeZone || 'Asia/Ho_Chi_Minh'} (Múi giờ Việt Nam)</span>
          </div>
        </div>

        {/* Attendees */}
        {proposal.attendees && proposal.attendees.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span>Người tham gia ({proposal.attendees.length}):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {proposal.attendees.map((attendee) => (
                <span
                  key={attendee.email}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                >
                  {attendee.email}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Meet badge */}
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <Video className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Google Meet: Tự động tạo liên kết cuộc gọi video</span>
        </div>

        {/* Error notification */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Lỗi tạo lịch: </span>
              {error}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          {onEditRequest && !isConfirmed && (
            <button
              type="button"
              onClick={onEditRequest}
              disabled={loading}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition sm:text-sm disabled:opacity-50"
            >
              Chỉnh sửa
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || isConfirmed}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang tạo trên Google Calendar...</span>
              </>
            ) : isConfirmed ? (
              <>
                <Check className="h-4 w-4" />
                <span>Đã xác nhận tạo lịch</span>
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
