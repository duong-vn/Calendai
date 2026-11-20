'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { z } from 'zod';
import {
  getVietnamThisWeekRange, getVietnamTodayRange, isEventInTimeRange, VIETNAM_DAY_MS, VIETNAM_TIME_ZONE,
} from '@/lib/calendar/date-range';
import type { UpcomingEventItem } from '@/lib/calendar/types';
import { UpcomingEventCard } from './UpcomingEventCard';

const HOUR_HEIGHT = 30;
const DAY_HEIGHT = 24 * HOUR_HEIGHT;
const MIN_EVENT_HEIGHT = 24;
const hours = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);
const weekday = new Intl.DateTimeFormat('vi-VN', { timeZone: VIETNAM_TIME_ZONE, weekday: 'long' });
const clock = new Intl.DateTimeFormat('vi-VN', { timeZone: VIETNAM_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const columns = 'grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]';
const navButton = 'inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-current/20 px-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10';
const eventButton = 'min-h-6 overflow-hidden rounded text-start text-xs font-semibold text-[#164d3e] focus-visible:z-10 dark:text-[#a8e6d7]';
const eventColor = 'border-s-2 border-[#1f7560] bg-[#d8eee7] dark:border-[#65c6b2] dark:bg-[#21443a]';
const WeekResponse = z.object({
  success: z.literal(true),
  events: z.array(z.object({
    id: z.string(),
    summary: z.string(),
    description: z.string().optional(),
    start: z.string(),
    end: z.string(),
    htmlLink: z.string(),
    hangoutLink: z.string().optional(),
    isAllDay: z.boolean(),
  })),
});
const ErrorResponse = z.object({ error: z.string() });

type WeekResult =
  | { events: UpcomingEventItem[]; error?: never }
  | { events?: never; error: string };

function shortDate(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function timedBlocks(events: UpcomingEventItem[], midnight: number) {
  const blocks = events.flatMap(event => {
    const start = Date.parse(event.start);
    if (!Number.isFinite(start)) return [];
    const end = Date.parse(event.end);
    const position = (instant: number) => (instant - midnight) * DAY_HEIGHT / VIETNAM_DAY_MS;
    const top = Math.max(0, position(start));
    const bottom = Math.min(DAY_HEIGHT, Math.max(top + 2, Number.isFinite(end) ? position(end) : top));
    const height = Math.max(MIN_EVENT_HEIGHT, bottom - top);
    return [{ event, top, bottom, height, time: clock.format(Math.max(midnight, start)), lane: 0, laneCount: 1 }];
  }).sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  // Share each overlapping group's width and reuse lanes as events end.
  let laneEnds: number[] = [];
  let groupStart = 0;
  for (const [index, block] of blocks.entries()) {
    if (laneEnds.every(end => end <= block.top)) {
      for (let i = groupStart; i < index; i++) blocks[i].laneCount = laneEnds.length;
      laneEnds = [];
      groupStart = index;
    }
    const reusable = laneEnds.findIndex(end => end <= block.top);
    block.lane = reusable < 0 ? laneEnds.length : reusable;
    laneEnds[block.lane] = block.top + block.height;
  }
  for (let i = groupStart; i < blocks.length; i++) blocks[i].laneCount = laneEnds.length;
  return blocks;
}

export function WeeklyCalendar() {
  const [anchor, setAnchor] = useState(() => new Date());
  const today = getVietnamTodayRange().timeMin;
  const { timeMin, timeMax } = getVietnamThisWeekRange(anchor);
  const monday = timeMin.slice(0, 10);
  const start = Date.parse(timeMin);
  const sunday = getVietnamTodayRange(new Date(Date.parse(timeMax) - VIETNAM_DAY_MS)).timeMin;

  return (
    <div className="flex min-h-0 flex-1 flex-col text-[#2b1f17] dark:text-[#f5ebd9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <h4 aria-live="polite" className="text-sm font-bold tabular-nums">
          {shortDate(monday)} – {shortDate(sunday)}/{sunday.slice(0, 4)} <span className="font-normal">(GMT+7)</span>
        </h4>
        <div className="flex gap-1">
          <button type="button" className={navButton} aria-label="Tuần trước" onClick={() => setAnchor(new Date(start - 7 * VIETNAM_DAY_MS))}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className={navButton} onClick={() => setAnchor(new Date())}>Tuần này</button>
          <button type="button" className={navButton} aria-label="Tuần sau" onClick={() => setAnchor(new Date(timeMax))}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <WeeklyEvents key={monday} monday={monday} start={start} today={today} />
    </div>
  );
}

function WeeklyEvents({ monday, start, today }: { monday: string; start: number; today: string }) {
  const [result, setResult] = useState<WeekResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<UpcomingEventItem | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const closeDetails = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    const message = 'Không thể tải lịch tuần. Vui lòng thử lại.';
    async function load() {
      try {
        const response = await fetch(`/api/calendar/upcoming?week=${monday}`, { signal: abort.signal });
        const data: unknown = await response.json();
        if (abort.signal.aborted) return;
        const week = WeekResponse.safeParse(data);
        const failure = ErrorResponse.safeParse(data);
        setResult(response.ok && week.success
          ? { events: week.data.events }
          : { error: failure.success ? failure.data.error : message });
      } catch {
        if (!abort.signal.aborted) setResult({ error: message });
      }
    }
    void load();
    return () => abort.abort();
  }, [monday, attempt]);

  useEffect(() => {
    if (selected) closeDetails.current?.focus();
  }, [selected]);

  if (!result) return <p role="status" className="p-4 text-sm">Đang tải lịch tuần…</p>;
  if (result.error !== undefined) {
    return (
      <div className="space-y-2 p-4 text-sm">
        <p role="alert">{result.error}</p>
        <button type="button" className={navButton} onClick={() => { setResult(null); setAttempt(attempt + 1); }}>Thử lại</button>
      </div>
    );
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const midnight = start + index * VIETNAM_DAY_MS;
    const date = new Date(midnight);
    const { timeMin, timeMax } = getVietnamTodayRange(date);
    const events = result.events.filter(event => isEventInTimeRange(event, timeMin, timeMax));
    return {
      date: timeMin,
      label: `${weekday.format(date)} · ${shortDate(timeMin)}`,
      allDay: events.filter(event => event.isAllDay),
      timed: timedBlocks(events.filter(event => !event.isAllDay), midnight),
    };
  });
  const viewEvent = (event: UpcomingEventItem, button: HTMLButtonElement) => {
    opener.current = button;
    setSelected(event);
  };

  return (
    <>
      {selected && (
        <section aria-label="Chi tiết sự kiện" className="mx-4 mb-2 max-h-[35dvh] shrink-0 overflow-auto sm:mx-6">
          <button type="button" className={`${navButton} mb-1`} ref={closeDetails} onClick={() => {
            setSelected(null);
            opener.current?.focus();
          }}>Đóng chi tiết</button>
          <UpcomingEventCard event={selected} showDetails />
        </section>
      )}
      {!result.events.length && <p role="status" className="px-4 pb-3 text-sm sm:px-6">Tuần này không có sự kiện.</p>}
      <div role="region" aria-label="Lưới lịch tuần" tabIndex={0} className="min-h-0 overflow-auto overscroll-contain border-t border-[#2d2015]/20 dark:border-[#453427]">
        <div className="min-w-[50rem] text-sm">
          <div className={`${columns} sticky top-0 z-20 border-b border-[#2d2015]/20 bg-[#fffaf2] dark:border-[#453427] dark:bg-[#1f1813]`}>
            <div />
            {days.map(day => (
              <div key={day.date} aria-current={day.date === today ? 'date' : undefined}
                className="border-s border-[#2d2015]/15 px-2 py-2 font-semibold aria-[current=date]:bg-[#d8eee7] dark:border-[#453427] dark:aria-[current=date]:bg-[#21443a]">
                {day.label}
              </div>
            ))}
          </div>
          <div className={`${columns} border-b border-[#2d2015]/20 dark:border-[#453427]`}>
            <div className="px-1 py-2 text-center text-xs font-semibold">Cả ngày</div>
            {days.map(day => (
              <div key={day.date} role="group" aria-label={`Cả ngày · ${day.label}`}
                className="flex min-w-0 flex-col gap-1 border-s border-[#2d2015]/15 p-1 dark:border-[#453427]">
                {day.allDay.map(event => (
                  <button key={event.id} type="button" title={event.summary}
                    className={`${eventButton} ${eventColor} truncate px-1.5 hover:brightness-95 dark:hover:brightness-125`}
                    onClick={e => viewEvent(event, e.currentTarget)}>{event.summary}</button>
                ))}
              </div>
            ))}
          </div>
          <div className={columns}>
            <div className="text-center text-xs tabular-nums" aria-hidden="true">
              {hours.map(hour => <div key={hour} className="pt-1" style={{ height: HOUR_HEIGHT }}>{hour}</div>)}
            </div>
            {days.map(day => (
              <section key={day.date} aria-label={day.label}
                style={{
                  height: DAY_HEIGHT,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_HEIGHT - 1}px, var(--week-line) ${HOUR_HEIGHT - 1}px ${HOUR_HEIGHT}px)`,
                }}
                className="relative border-s border-[#2d2015]/15 [--week-line:#2d201520] dark:border-[#453427] dark:[--week-line:#453427]">
                {day.timed.map(({ event, time, top, bottom, height, lane, laneCount }) => {
                  const label = `${time} ${event.summary}`;
                  const width = 100 / laneCount;
                  return (
                    <button key={event.id} type="button" title={label} className={`${eventButton} group absolute flex items-start`}
                      style={{ top, height, left: `${lane * width}%`, width: `${width}%` }}
                      onClick={e => viewEvent(event, e.currentTarget)}>
                      <span aria-hidden="true"
                        className={`${eventColor} pointer-events-none absolute inset-x-0 top-0 rounded group-hover:brightness-95 dark:group-hover:brightness-125`}
                        style={{ height: bottom - top }} />
                      <span className="relative min-w-0 truncate px-1.5 py-0.5">
                        <span className={height >= 36 ? 'block tabular-nums' : 'tabular-nums'}>{time}</span>{' '}
                        <span>{event.summary}</span>
                      </span>
                    </button>
                  );
                })}
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
