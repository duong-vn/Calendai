import { z } from 'zod';
import { EventEtagSchema, EventIdSchema, type CalendarConflict, type ResolveConflictInput } from './conflict-schema';
import { OffsetDateTimeSchema } from './proposal-schema';

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TimeZoneSchema = z.string().min(1).refine((timeZone) => {
  try { new Intl.DateTimeFormat('en', { timeZone }); return true; } catch { return false; }
});
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => {
  const instant = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === date;
});
const EventTimeSchema = z.object({
  date: DateSchema.optional(),
  dateTime: OffsetDateTimeSchema.optional(),
  timeZone: TimeZoneSchema.optional(),
}).refine((time) => Boolean(time.date) !== Boolean(time.dateTime));
const GoogleEventSchema = z.object({
  id: EventIdSchema,
  summary: z.string().optional(),
  etag: EventEtagSchema.optional(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
  transparency: z.enum(['opaque', 'transparent']).optional(),
  start: EventTimeSchema.optional(),
  end: EventTimeSchema.optional(),
  attendees: z.array(z.object({ self: z.boolean().optional(), responseStatus: z.string().optional() })).optional(),
  recurrence: z.array(z.string()).optional(),
  recurringEventId: EventIdSchema.optional(),
});
type GoogleEvent = z.infer<typeof GoogleEventSchema>;
interface TimeRange { startDateTime: string; endDateTime: string }

export class CalendarLookupError extends Error {
  constructor() { super('Không thể kiểm tra lịch Google lúc này. Vui lòng thử lại.'); }
}
export class CalendarStaleEventError extends Error {
  constructor() { super('Sự kiện đã thay đổi hoặc không còn trùng lịch. Vui lòng kiểm tra lại lịch.'); }
}
export class CalendarOverlapError extends Error {
  constructor(public readonly conflicts: CalendarConflict[]) {
    super('Khoảng thời gian này trùng với lịch hiện có. Vui lòng chọn giờ khác hoặc xác nhận vẫn tạo.');
  }
}
export class CalendarResolveError extends Error {
  constructor() { super('Không thể thay đổi cả chuỗi sự kiện. Vui lòng chọn một lần diễn ra cụ thể.'); }
}

export function rangesOverlap(left: TimeRange, right: TimeRange): boolean {
  return Date.parse(left.startDateTime) < Date.parse(right.endDateTime) &&
    Date.parse(right.startDateTime) < Date.parse(left.endDateTime);
}

async function googleJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new CalendarLookupError();
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || 'error' in data) throw new CalendarLookupError();
  return data;
}

function blocking(event: GoogleEvent): boolean {
  return event.status !== 'cancelled' && event.transparency !== 'transparent' &&
    !event.attendees?.some((attendee) => attendee.self && attendee.responseStatus === 'declined');
}

// Find the first instant of a local date, including DST transitions that skip midnight.
function dayBoundary(date: string, timeZone: string, cache: Map<string, number>): number {
  const key = `${timeZone}/${date}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const formatter = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const localDate = (instant: number) => {
    const parts = formatter.formatToParts(instant);
    return ['year', 'month', 'day'].map((part) => (parts.find((value) => value.type === part)?.value ?? '').padStart(part === 'year' ? 4 : 2, '0')).join('-');
  };
  const utc = Date.parse(`${date}T00:00:00Z`);
  let low = utc - 48 * 3600000;
  let high = utc + 48 * 3600000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (localDate(middle) < date) low = middle + 1;
    else high = middle;
  }
  cache.set(key, low);
  return low;
}

function conflictFromEvent(event: GoogleEvent, calendarTimeZone?: string, cache = new Map<string, number>()): CalendarConflict {
  if (!event.start || !event.end || !event.etag) throw new CalendarLookupError();
  const isAllDay = Boolean(event.start.date);
  if (isAllDay !== Boolean(event.end.date)) throw new CalendarLookupError();
  const timeZone = event.start.timeZone ?? calendarTimeZone;
  if (isAllDay && (!timeZone || event.end.date! <= event.start.date!)) throw new CalendarLookupError();
  const start = isAllDay ? new Date(dayBoundary(event.start.date!, timeZone!, cache)).toISOString() : event.start.dateTime!;
  const end = isAllDay ? new Date(dayBoundary(event.end.date!, timeZone!, cache)).toISOString() : event.end.dateTime!;
  if (!(Date.parse(end) > Date.parse(start))) throw new CalendarLookupError();
  return {
    id: event.id, summary: event.summary || '(Không có tiêu đề)', start, end,
    etag: event.etag, timeZone: timeZone ?? 'Asia/Ho_Chi_Minh', isAllDay,
  };
}

export async function findCalendarConflicts(
  accessToken: string,
  range: TimeRange,
  excludeIds: string[] = []
): Promise<CalendarConflict[]> {
  const parsedRange = z.object({ startDateTime: OffsetDateTimeSchema, endDateTime: OffsetDateTimeSchema }).safeParse(range);
  if (!parsedRange.success || Date.parse(range.endDateTime) <= Date.parse(range.startDateTime)) throw new CalendarLookupError();
  const query = new URLSearchParams({
    timeMin: range.startDateTime, timeMax: range.endDateTime,
    singleEvents: 'true', showDeleted: 'false', maxResults: '2500',
  });
  const signal = AbortSignal.timeout(15000);
  const seenPages = new Set<string>();
  const conflicts = new Map<string, CalendarConflict>();
  const boundaries = new Map<string, number>();
  const PageSchema = z.object({
    items: z.array(GoogleEventSchema).optional().default([]),
    timeZone: TimeZoneSchema,
    nextPageToken: z.string().min(1).max(10000).optional(),
  });
  for (let page = 0; page < 100; page++) {
    const response = await fetch(`${EVENTS_URL}?${query}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal, cache: 'no-store' });
    const result = PageSchema.safeParse(await googleJson(response));
    if (!result.success) throw new CalendarLookupError();
    for (const event of result.data.items) {
      if (!blocking(event) || excludeIds.includes(event.id)) continue;
      const conflict = conflictFromEvent(event, result.data.timeZone, boundaries);
      if (rangesOverlap(range, { startDateTime: conflict.start, endDateTime: conflict.end })) conflicts.set(event.id, conflict);
    }
    const next = result.data.nextPageToken;
    if (!next) return [...conflicts.values()];
    if (seenPages.has(next)) throw new CalendarLookupError();
    seenPages.add(next);
    query.set('pageToken', next);
  }
  // shortcut: cap at 100 pages and fail closed; raise only if a real calendar needs more.
  throw new CalendarLookupError();
}

export async function resolveCalendarConflict(accessToken: string, input: ResolveConflictInput): Promise<void> {
  const url = `${EVENTS_URL}/${encodeURIComponent(input.eventId)}`;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000), cache: 'no-store' });
  if ([404, 410, 412].includes(response.status)) throw new CalendarStaleEventError();
  const parsed = GoogleEventSchema.safeParse(await googleJson(response));
  if (!parsed.success || parsed.data.id !== input.eventId) throw new CalendarLookupError();
  const event = parsed.data;
  if (event.etag !== input.etag || !blocking(event)) throw new CalendarStaleEventError();
  if (event.recurrence?.length && !event.recurringEventId) throw new CalendarResolveError();
  let calendarTimeZone: string | undefined;
  if (event.start?.date && !event.start.timeZone) {
    const listed = (await findCalendarConflicts(accessToken, input.proposal)).find(item => item.id === event.id);
    if (!listed || listed.etag !== event.etag) throw new CalendarStaleEventError();
    calendarTimeZone = listed.timeZone;
  }
  const conflict = conflictFromEvent(event, calendarTimeZone);
  if (!rangesOverlap(input.proposal, { startDateTime: conflict.start, endDateTime: conflict.end })) throw new CalendarStaleEventError();
  let body: string | undefined;
  if (input.action === 'reschedule') {
    if (!input.startDateTime || !input.endDateTime || Date.parse(input.endDateTime) <= Date.parse(input.startDateTime)) throw new CalendarResolveError();
    const range = { startDateTime: input.startDateTime, endDateTime: input.endDateTime };
    if (rangesOverlap(range, input.proposal)) throw new CalendarOverlapError([conflict]);
    const collisions = await findCalendarConflicts(accessToken, range, [event.id]);
    if (collisions.length) throw new CalendarOverlapError(collisions);
    body = JSON.stringify({
      start: { dateTime: input.startDateTime, timeZone: event.start?.timeZone ?? calendarTimeZone, date: null },
      end: { dateTime: input.endDateTime, timeZone: event.end?.timeZone ?? calendarTimeZone, date: null },
    });
  }
  const mutation = await fetch(`${url}?sendUpdates=all`, {
    method: input.action === 'cancel' ? 'DELETE' : 'PATCH',
    headers: { ...headers, 'If-Match': input.etag, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body, signal: AbortSignal.timeout(15000),
  });
  if ([404, 410, 412].includes(mutation.status)) throw new CalendarStaleEventError();
  if (!mutation.ok || (input.action === 'cancel' && mutation.status !== 204)) throw new CalendarLookupError();
  if (input.action === 'reschedule') {
    const result = GoogleEventSchema.safeParse(await googleJson(mutation));
    if (!result.success || result.data.id !== input.eventId || result.data.status === 'cancelled') throw new CalendarLookupError();
    const updated = conflictFromEvent(result.data, conflict.timeZone);
    if (Date.parse(updated.start) !== Date.parse(input.startDateTime!) || Date.parse(updated.end) !== Date.parse(input.endDateTime!)) throw new CalendarLookupError();
  }
}
