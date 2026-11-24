import { Clock, ExternalLink, Video } from 'lucide-react';
import { VIETNAM_TIME_ZONE } from '@/lib/calendar/date-range';
import type { UpcomingEventItem } from '@/lib/calendar/types';
import { safeHttpsUrl } from '@/lib/links';

function formatEventTime(isoString: string, isAllDay: boolean) {
  try {
    const d = new Date(isoString);
    const formatted = new Intl.DateTimeFormat('vi-VN', {
      // Date-only values are calendar dates, not instants to shift into GMT+7.
      timeZone: isAllDay ? 'UTC' : VIETNAM_TIME_ZONE,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      ...(isAllDay ? {} : { hour: '2-digit', minute: '2-digit', hour12: false } as const),
    }).format(d);
    return isAllDay ? `Cả ngày · ${formatted}` : formatted;
  } catch {
    return isoString;
  }
}

export function UpcomingEventCard({ event: evt, showDetails }: { event: UpcomingEventItem; showDetails?: boolean }) {
  const safeCalendarLink = safeHttpsUrl(evt.htmlLink, 'calendar');
  const safeMeetLink = safeHttpsUrl(evt.hangoutLink, 'meet');

  return (
    <div
      className="rounded-2xl border-2 border-[#2d2015] bg-[#fffaf2] p-4 shadow-[2px_2px_0px_#2d2015] transition-all hover:border-[#c25e2e] dark:border-[#453427] dark:bg-[#16120f] dark:hover:border-[#e07a3f]"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 [overflow-wrap:anywhere] text-sm font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
          {evt.summary}
        </h4>
        {safeCalendarLink && <a
          href={safeCalendarLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#786455] hover:text-[#c25e2e] transition-colors dark:text-[#ba9f88] dark:hover:text-[#e07a3f]"
          title="Mở trên Google Calendar"
        >
          <ExternalLink className="h-4 w-4" />
        </a>}
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#786455] dark:text-[#ba9f88]">
        <Clock className="h-3.5 w-3.5 text-[#c25e2e] shrink-0 dark:text-[#e07a3f]" />
        <span>{formatEventTime(evt.start, evt.isAllDay)}</span>
      </div>

      {showDetails && (
        <>
          {!evt.isAllDay && <p className="mt-1 text-xs">Kết thúc · {formatEventTime(evt.end, false)}</p>}
          {evt.description && <p className="mt-2 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{evt.description}</p>}
        </>
      )}

      {safeMeetLink && (
        <div className="mt-3 flex flex-wrap gap-3 items-center justify-between border-t-2 border-[#2d2015]/10 pt-2.5 dark:border-[#453427]">
          <div className="flex items-center gap-1.5 text-xs text-[#1f7560] dark:text-[#2dd4bf]">
            <Video className="h-3.5 w-3.5" />
            <span className="font-bold">Google Meet</span>
          </div>
          <a
            href={safeMeetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border-2 border-[#2d2015] bg-[#1f7560] px-3.5 py-1 text-xs font-bold text-white shadow-[2px_2px_0px_#2d2015] hover:bg-[#165a4a] transition-all active:translate-x-[1px] active:translate-y-[1px] dark:border-[#453427] dark:bg-[#2dd4bf] dark:text-[#14110f]"
          >
            Tham gia
          </a>
        </div>
      )}
    </div>
  );
}
