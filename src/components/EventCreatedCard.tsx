'use client';

import { useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Video,
} from 'lucide-react';
import type { CalendarEventResult } from '@/lib/calendar/types';

interface EventCreatedCardProps {
  event: CalendarEventResult;
  isMock?: boolean;
}

export function EventCreatedCard({ event, isMock }: EventCreatedCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    if (!event.hangoutLink) return;
    try {
      await navigator.clipboard.writeText(event.hangoutLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const formattedStart = (() => {
    try {
      const d = new Date(event.start);
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: event.timeZone || 'Asia/Ho_Chi_Minh',
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d);
    } catch {
      return event.start;
    }
  })();

  return (
    <div className="my-3 overflow-hidden rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 p-4 shadow-md sm:p-5">
      {/* Title & Status badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Đã tạo sự kiện thành công!
            </span>
            <h4 className="text-base font-bold text-slate-900 sm:text-lg">
              {event.summary}
            </h4>
          </div>
        </div>

        {isMock && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
            Mock Mode
          </span>
        )}
      </div>

      {/* Date & Time */}
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-700 sm:text-sm">
        <Clock className="h-4 w-4 text-emerald-700 shrink-0" />
        <span>{formattedStart} (Múi giờ: {event.timeZone || 'Asia/Ho_Chi_Minh'})</span>
      </div>

      {/* Google Meet Box */}
      {event.hangoutLink && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-slate-800">
                Google Meet Link:
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-slate-500" />
                  <span>Sao chép</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <a
              href={event.hangoutLink}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-xs font-medium text-blue-600 hover:underline sm:text-sm"
            >
              {event.hangoutLink}
            </a>

            <a
              href={event.hangoutLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
            >
              <Video className="h-3.5 w-3.5" />
              <span>Vào họp ngay</span>
            </a>
          </div>
        </div>
      )}

      {/* Google Calendar Link Button */}
      <div className="mt-4 flex items-center justify-between border-t border-emerald-200/60 pt-3">
        {isMock ? (
          <span className="text-xs text-slate-500 italic">
            Chế độ giả lập phục vụ kiểm thử giao diện & API.
          </span>
        ) : (
          <span className="text-xs text-slate-500">
            Sự kiện đã đồng bộ với Google Calendar của bạn.
          </span>
        )}

        <a
          href={event.htmlLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Mở Google Calendar</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
