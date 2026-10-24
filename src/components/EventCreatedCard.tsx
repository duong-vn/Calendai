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
    <div className="my-3 overflow-hidden rounded-2xl border-2 border-[#2d2015] bg-[#fffaf2] shadow-[4px_4px_0px_#2d2015] dark:border-[#453427] dark:bg-[#1f1813] dark:shadow-[4px_4px_0px_#453427]">
      {/* Top success banner (Stamped wax seal) */}
      <div className="flex items-center justify-between border-b-2 border-[#2d2015] bg-[#f0f9f4] px-4 py-2.5 sm:px-5 dark:border-[#453427] dark:bg-[#152a1f]">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#2d8a57] dark:text-[#34d399]" />
          <span className="text-xs font-bold text-[#2d8a57] dark:text-[#34d399]">
            Đã tạo sự kiện thành công!
          </span>
        </div>
        {isMock && (
          <span className="rounded-md border border-[#2d2015] bg-[#fffaf2] px-2 py-0.5 text-[11px] font-mono font-bold text-[#d49439] dark:border-[#fbbf24]/40 dark:bg-[#211a14] dark:text-[#fbbf24]">
            Mock Mode
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {/* Title */}
        <div className="flex items-start gap-3">
          <div className="mt-1 h-9 w-1.5 rounded-full bg-[#2d8a57] shrink-0 dark:bg-[#34d399]" />
          <div>
            <h4 className="text-base font-bold text-[#2b1f17] sm:text-lg dark:text-[#f5ebd9]">
              {event.summary}
            </h4>
            <div className="mt-1 flex items-center gap-2 text-xs text-[#786455] sm:text-sm dark:text-[#ba9f88]">
              <Clock className="h-3.5 w-3.5 text-[#2d8a57] shrink-0 dark:text-[#34d399]" />
              <span>{formattedStart} (Múi giờ: {event.timeZone || 'Asia/Ho_Chi_Minh'})</span>
            </div>
          </div>
        </div>

        {/* Google Meet Card */}
        {event.hangoutLink && (
          <div className="mt-4 rounded-xl border-2 border-[#2d2015]/30 bg-[#f5eee1] p-3.5 dark:border-[#453427] dark:bg-[#16120f]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2d2015] bg-[#1f7560] text-white shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2dd4bf] dark:text-[#14110f]">
                  <Video className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
                  Google Meet
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex min-h-[34px] touch-manipulation items-center gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-3 py-1 text-xs font-bold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] hover:bg-[#ede4d5] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427]"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-[#2d8a57] dark:text-[#34d399]" />
                    <span className="text-[#2d8a57] dark:text-[#34d399]">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-[#786455] dark:text-[#ba9f88]" />
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
                className="truncate text-xs font-mono font-medium text-[#c25e2e] hover:underline sm:text-sm dark:text-[#e07a3f]"
              >
                {event.hangoutLink}
              </a>

              <a
                href={event.hangoutLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[38px] touch-manipulation items-center justify-center gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#1f7560] px-4 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0px_#2d2015] hover:bg-[#165a4a] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#2dd4bf] dark:text-[#14110f] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#5eead4]"
              >
                <Video className="h-3.5 w-3.5" />
                <span>Vào phòng họp</span>
              </a>
            </div>
          </div>
        )}

        {!event.hangoutLink && event.conferenceStatus === 'pending' && (
          <p role="status" className="mt-3 text-xs text-[#786455] dark:text-[#ba9f88]">
            Sự kiện đã được lưu. Google Meet đang được tạo; bạn có thể kiểm tra lại trong Google Calendar.
          </p>
        )}
        {!event.hangoutLink && event.conferenceStatus === 'failure' && (
          <p role="alert" className="mt-3 text-xs text-[#a63024] dark:text-[#f87171]">
            Sự kiện đã được lưu nhưng chưa tạo được Google Meet. Vui lòng thêm liên kết trong Google Calendar.
          </p>
        )}

        {/* Google Calendar Link Button */}
        <div className="mt-4 flex items-center justify-between border-t-2 border-[#2d2015]/20 pt-3 dark:border-[#453427]">
          {isMock ? (
            <span className="text-[11px] text-[#786455] dark:text-[#ba9f88]">
              Chế độ giả lập phục vụ kiểm thử API & UI.
            </span>
          ) : (
            <span className="text-[11px] text-[#786455] dark:text-[#ba9f88]">
              Đã lưu trên Google Calendar.
            </span>
          )}

          <a
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#c25e2e] hover:underline dark:text-[#e07a3f]"
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
