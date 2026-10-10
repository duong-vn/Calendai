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
        weekday: 'long',
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
    <div className="my-3 overflow-hidden rounded-2xl border border-[#ceead6] bg-white shadow-xs dark:border-[#23382d] dark:bg-[#17241e]">
      {/* Top success banner */}
      <div className="flex items-center justify-between border-b border-[#e6f4ea] bg-[#e6f4ea]/70 px-4 py-2.5 sm:px-5 dark:border-[#23382d] dark:bg-[#153426]/70">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#137333] dark:text-[#10b981]" />
          <span className="text-xs font-medium text-[#137333] dark:text-[#34d399]">
            Đã tạo sự kiện thành công!
          </span>
        </div>
        {isMock && (
          <span className="rounded-full bg-[#fef7e0] px-2.5 py-0.5 text-[11px] font-medium text-[#b06000] dark:bg-[#332408] dark:text-[#fde047]">
            Mock Mode
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {/* Title */}
        <div className="flex items-start gap-3">
          <div className="mt-1 h-9 w-1 rounded-full bg-[#34a853] shrink-0 dark:bg-[#10b981]" />
          <div>
            <h4 className="text-base font-medium text-[#1f1f1f] sm:text-lg dark:text-[#f1f5f9]">
              {event.summary}
            </h4>
            <div className="mt-1 flex items-center gap-2 text-xs text-[#5f6368] sm:text-sm dark:text-[#94a3b8]">
              <Clock className="h-3.5 w-3.5 text-[#34a853] shrink-0 dark:text-[#10b981]" />
              <span>{formattedStart} (Múi giờ: {event.timeZone || 'Asia/Ho_Chi_Minh'})</span>
            </div>
          </div>
        </div>

        {/* Google Meet Card */}
        {event.hangoutLink && (
          <div className="mt-4 rounded-xl border border-[#dadce0] bg-[#f8fafd] p-3.5 dark:border-[#23382d] dark:bg-[#1c2e26]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#00897b] text-white dark:bg-[#059669]">
                  <Video className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-medium text-[#3c4043] dark:text-[#f1f5f9]">
                  Google Meet
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-3 py-1 text-xs font-medium text-[#3c4043] hover:bg-[#f1f3f4] transition-colors dark:border-[#23382d] dark:bg-[#17241e] dark:text-[#cbd5e1] dark:hover:bg-[#23382d]"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-[#137333] dark:text-[#10b981]" />
                    <span className="text-[#137333] dark:text-[#34d399]">Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-[#5f6368] dark:text-[#94a3b8]" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <a
                href={event.hangoutLink}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-xs font-medium text-[#1a73e8] hover:underline sm:text-sm dark:text-[#34d399]"
              >
                {event.hangoutLink}
              </a>

              <a
                href={event.hangoutLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#00897b] px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-[#00796b] transition-colors dark:bg-[#059669] dark:hover:bg-[#047857]"
              >
                <Video className="h-3.5 w-3.5" />
                <span>Vào phòng họp</span>
              </a>
            </div>
          </div>
        )}

        {/* Google Calendar Link Button */}
        <div className="mt-4 flex items-center justify-between border-t border-[#f1f3f4] pt-3 dark:border-[#23382d]">
          {isMock ? (
            <span className="text-[11px] text-[#747775] dark:text-[#94a3b8]">
              Chế độ giả lập phục vụ kiểm thử API & UI.
            </span>
          ) : (
            <span className="text-[11px] text-[#747775] dark:text-[#94a3b8]">
              Đã đồng bộ trên Google Calendar.
            </span>
          )}

          <a
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1a73e8] hover:underline dark:text-[#34d399]"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Mở Google Calendar</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
