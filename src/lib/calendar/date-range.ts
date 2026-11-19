import type { UpcomingEventItem } from './types';

export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh' as const;
export const VIETNAM_UTC_OFFSET = '+07:00' as const;

export interface VietnamDateRange {
  timeMin: string;
  timeMax: string;
  timeZone: typeof VIETNAM_TIME_ZONE;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const vietnamDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: VIETNAM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function pad4(value: number): string {
  return String(value).padStart(4, '0');
}

function formatVietnamDate(year: number, month: number, day: number): string {
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

function formatVietnamMidnight(year: number, month: number, day: number): string {
  return `${formatVietnamDate(year, month, day)}T00:00:00${VIETNAM_UTC_OFFSET}`;
}

function shiftCalendarDate(year: number, month: number, day: number, deltaDays: number): {
  year: number;
  month: number;
  day: number;
} {
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * Extracts the calendar date (year, month 1-12, day 1-31) and day-of-week
 * (0 = Sunday .. 6 = Saturday) for the given instant in `Asia/Ho_Chi_Minh`.
 */
export function getVietnamDateParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
} {
  const parts = vietnamDateFormatter.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;

  for (const part of parts) {
    if (part.type === 'year') year = Number(part.value);
    else if (part.type === 'month') month = Number(part.value);
    else if (part.type === 'day') day = Number(part.value);
  }

  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, dayOfWeek };
}

/**
 * Returns the full Vietnam calendar day containing `date` as a half-open interval
 * `[00:00:00+07:00 today, 00:00:00+07:00 tomorrow)`.
 *
 * Includes events that already started or ended earlier today in `Asia/Ho_Chi_Minh`,
 * and excludes events starting on or after tomorrow 00:00:00+07:00.
 */
export function getVietnamTodayRange(date: Date = new Date()): VietnamDateRange {
  const { year, month, day } = getVietnamDateParts(date);
  const tomorrow = shiftCalendarDate(year, month, day, 1);

  return {
    timeMin: formatVietnamMidnight(year, month, day),
    timeMax: formatVietnamMidnight(tomorrow.year, tomorrow.month, tomorrow.day),
    timeZone: VIETNAM_TIME_ZONE,
  };
}

/**
 * Returns the current Vietnam calendar week (ISO 8601 Monday–Sunday) containing `date`
 * as a half-open interval `[Monday 00:00:00+07:00, next Monday 00:00:00+07:00)`.
 *
 * Includes events earlier in the same week and excludes events starting on or after
 * next Monday 00:00:00+07:00.
 */
export function getVietnamThisWeekRange(date: Date = new Date()): VietnamDateRange {
  const { year, month, day, dayOfWeek } = getVietnamDateParts(date);
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = shiftCalendarDate(year, month, day, -daysSinceMonday);
  const nextMonday = shiftCalendarDate(monday.year, monday.month, monday.day, 7);

  return {
    timeMin: formatVietnamMidnight(monday.year, monday.month, monday.day),
    timeMax: formatVietnamMidnight(nextMonday.year, nextMonday.month, nextMonday.day),
    timeZone: VIETNAM_TIME_ZONE,
  };
}

function parseEventBoundaryMs(value: string, isAllDay: boolean): number {
  if (isAllDay && DATE_ONLY_PATTERN.test(value)) {
    return Date.parse(`${value}T00:00:00${VIETNAM_UTC_OFFSET}`);
  }
  return Date.parse(value);
}

/**
 * Checks whether an event overlaps the half-open query window `[timeMin, timeMax)`.
 * All-day `YYYY-MM-DD` bounds are interpreted at Vietnam midnight (`+07:00`).
 */
export function isEventInTimeRange(
  event: Pick<UpcomingEventItem, 'start' | 'end' | 'isAllDay'>,
  timeMin: string,
  timeMax: string
): boolean {
  const windowStartMs = Date.parse(timeMin);
  const windowEndMs = Date.parse(timeMax);
  if (!Number.isFinite(windowStartMs) || !Number.isFinite(windowEndMs)) {
    return true;
  }

  const startMs = parseEventBoundaryMs(event.start, event.isAllDay);
  const endMs = parseEventBoundaryMs(event.end, event.isAllDay);

  if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
    if (endMs <= startMs) {
      return startMs >= windowStartMs && startMs < windowEndMs;
    }
    return startMs < windowEndMs && endMs > windowStartMs;
  }

  if (Number.isFinite(startMs)) {
    if (event.isAllDay && DATE_ONLY_PATTERN.test(event.start)) {
      return startMs < windowEndMs && startMs + 24 * 60 * 60 * 1000 > windowStartMs;
    }
    return startMs >= windowStartMs && startMs < windowEndMs;
  }

  return true;
}
