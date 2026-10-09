'use client';

import { useState } from 'react';
import {
  AlertCircle,
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
}: MeetingPreviewCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [createMeet, setCreateMeet] = useState(Boolean(proposal.createMeet));

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
          createMeet: Boolean(createMeet),
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
    <div className="my-3 overflow-hidden rounded-2xl border border-[#dadce0] bg-white shadow-xs transition-shadow hover:shadow-sm">
      {/* Google Calendar Top Strip */}
      <div className="flex items-center justify-between border-b border-[#f1f3f4] bg-[#f8fafd] px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1a73e8] text-white">
            <Calendar className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-medium text-[#1a73e8]">
            Google Calendar • Bản xem trước
          </span>
        </div>
        <span className="rounded-full bg-[#fef7e0] px-2.5 py-0.5 text-[11px] font-medium text-[#b06000]">
          Chờ xác nhận
        </span>
      </div>

      {/* Main Event Body */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {/* Calendar blue bar */}
          <div className="mt-1 h-10 w-1 rounded-full bg-[#1a73e8] shrink-0" />
          <div className="flex-1">
            <h4 className="text-base font-medium text-[#1f1f1f] sm:text-lg">
              {proposal.summary}
            </h4>
            {proposal.description && (
              <p className="mt-1 text-xs text-[#5f6368] sm:text-sm leading-relaxed">
                {proposal.description}
              </p>
            )}
          </div>
        </div>

        {/* Details list */}
        <div className="mt-4 space-y-2.5 rounded-xl bg-[#f8fafd] p-3.5 border border-[#edf2fa]">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-[#3c4043]">
            <Clock className="h-4 w-4 text-[#1a73e8] shrink-0" />
            <span>
              {formattedDate} • {formattedTimeRange}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-[#5f6368]">
            <Globe className="h-4 w-4 text-[#747775] shrink-0" />
            <span>Múi giờ: {proposal.timeZone || 'Asia/Ho_Chi_Minh'} (GMT+7)</span>
          </div>

          {/* Attendees */}
          {proposal.attendees && proposal.attendees.length > 0 && (
            <div className="flex items-start gap-2.5 text-xs text-[#5f6368]">
              <Users className="h-4 w-4 text-[#747775] shrink-0 mt-0.5" />
              <div className="flex flex-wrap gap-1.5">
                {proposal.attendees.map((attendee) => (
                  <span
                    key={attendee.email}
                    className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-xs text-[#3c4043] border border-[#dadce0]"
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
          className={`mt-3 flex items-center justify-between w-full rounded-xl p-3 text-xs sm:text-sm border transition-all text-left ${
            createMeet
              ? 'bg-[#e6f4ea] text-[#137333] border-[#ceead6] hover:bg-[#d8eedd]'
              : 'bg-[#f8fafd] text-[#5f6368] border-[#dadce0] hover:bg-[#f1f3f4]'
          } ${isConfirmed || loading ? 'cursor-default' : 'cursor-pointer'}`}
          title="Bấm để bật hoặc tắt tạo link Google Meet"
        >
          <div className="flex items-center gap-2">
            <Video
              className={`h-4 w-4 shrink-0 ${
                createMeet ? 'text-[#0f9d58]' : 'text-[#747775]'
              }`}
            />
            <span className="font-medium">
              {createMeet ? 'Google Meet (Đang bật)' : 'Google Meet (Đang tắt)'}
            </span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              createMeet
                ? 'bg-[#ceead6] text-[#0d652d]'
                : 'bg-[#e8eaed] text-[#5f6368]'
            }`}
          >
            {createMeet ? 'Sẽ tạo link Meet' : 'Không tạo Meet'}
          </span>
        </button>

        {/* Error notification */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#fce8e6] p-3 text-xs text-[#c5221f] border border-[#fad2cf]">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#ea4335] mt-0.5" />
            <div>
              <span className="font-semibold">Lỗi tạo lịch: </span>
              {error}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-[#f1f3f4] pt-4">
          {onEditRequest && !isConfirmed && (
            <button
              type="button"
              onClick={onEditRequest}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-4 py-2 text-xs font-medium text-[#1a73e8] hover:bg-[#f8fafd] transition-colors sm:text-sm disabled:opacity-50"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Chỉnh sửa</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || isConfirmed}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 py-2 text-xs font-medium text-white shadow-xs hover:bg-[#1557b0] transition-colors sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"
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
