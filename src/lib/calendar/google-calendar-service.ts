import { createHash } from 'node:crypto';
import { safeHttpsUrl } from '../links';
import {
  CalendarPermissionError,
  CalendarUnauthorizedError,
  isCalendarPermissionResponse,
  isGoogleCalendarPermissionError,
} from './calendar-auth';
import { DEFAULT_REMINDER_MINUTES } from './reminders';
import type {
  CalendarEventResult,
  CreateCalendarEventInput,
  UpcomingEventItem,
} from './types';

export { CalendarPermissionError, CalendarUnauthorizedError };

const GOOGLE_CALENDAR_BASE_URL = 'https://www.googleapis.com/calendar/v3';

interface GoogleApiConferenceData {
  createRequest?: {
    requestId?: string;
    status?: {
      statusCode?: 'success' | 'pending' | 'failure';
    };
  };
  entryPoints?: Array<{
    entryPointType?: string;
    uri?: string;
    label?: string;
  }>;
}

interface GoogleApiEventResponse {
  id: string;
  summary?: string;
  description?: string;
  status?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  endTimeUnspecified?: boolean;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  conferenceData?: GoogleApiConferenceData;
  extendedProperties?: {
    private?: Record<string, string>;
  };
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ message: string; domain: string; reason: string }>;
  };
}

interface GoogleApiEventsListResponse {
  items?: GoogleApiEventResponse[];
  nextPageToken?: string;
  error?: {
    code?: number;
    message?: string;
  };
}

export class CalendarProposalConflictError extends Error {
  constructor() {
    super('Mã đề xuất đã được sử dụng cho sự kiện khác. Vui lòng tạo đề xuất mới.');
    this.name = 'CalendarProposalConflictError';
  }
}

interface CalendarOperation {
  accountId: string;
  proposalId: string;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function calendarProposalEventId(accountId: string, proposalId: string): string {
  return digest(JSON.stringify(['calendai-confirm-v1', accountId, proposalId]));
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  input: CreateCalendarEventInput,
  operation?: CalendarOperation,
  beforeInsert?: (eventId: string | undefined) => Promise<void>
): Promise<CalendarEventResult> {
  const timeZone = input.timeZone || 'Asia/Ho_Chi_Minh';
  const shouldCreateMeet = input.createMeet !== false;
  const eventId = operation
    ? calendarProposalEventId(operation.accountId, operation.proposalId)
    : undefined;
  const requestId = eventId ?? crypto.randomUUID();

  const url = `${GOOGLE_CALENDAR_BASE_URL}/calendars/primary/events?conferenceDataVersion=1${input.attendees?.length ? '&sendUpdates=all' : ''}`;

  const requestBody: Record<string, unknown> = {
    summary: input.summary,
    description: input.description ?? '',
    reminders: {
      useDefault: false,
      overrides: (input.reminderMinutes ?? DEFAULT_REMINDER_MINUTES).map(minutes => ({ method: 'popup', minutes })),
    },
    start: {
      dateTime: input.startDateTime,
      timeZone,
    },
    end: {
      dateTime: input.endDateTime,
      timeZone,
    },
    attendees: input.attendees && input.attendees.length > 0
      ? input.attendees.map((att) => ({ email: att.email, displayName: att.displayName }))
      : undefined,
  };

  if (shouldCreateMeet) {
    requestBody.conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    };
  }

  // Retries of pre-reminder drafts must still match their original Google event.
  const { reminders: _reminders, ...legacyBody } = requestBody;
  const legacyPayload = input.reminderMinutes === undefined ? digest(JSON.stringify(legacyBody)) : undefined;
  const privateProperties = eventId && operation ? {
    calendaiOperation: eventId,
    calendaiOwner: digest(operation.accountId),
    calendaiPayload: digest(JSON.stringify(requestBody)),
  } : undefined;

  if (eventId && privateProperties) {
    requestBody.id = eventId;
    requestBody.extendedProperties = { private: privateProperties };
  }

  const reconcile = async (cause: unknown, collision = false, response?: Response): Promise<GoogleApiEventResponse> => {
    const existingResponse = response ?? await fetch(`${GOOGLE_CALENDAR_BASE_URL}/calendars/primary/events/${eventId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    if (!existingResponse.ok) {
      if (collision && (existingResponse.status === 404 || existingResponse.status === 410)) {
        throw new CalendarProposalConflictError();
      }
      throw cause;
    }
    const existing = await existingResponse.json() as GoogleApiEventResponse;
    const metadata = existing.extendedProperties?.private;
    if (existing.error || existing.id !== eventId || existing.status === 'cancelled' ||
      !privateProperties || metadata?.calendaiOperation !== privateProperties.calendaiOperation ||
      metadata?.calendaiOwner !== privateProperties.calendaiOwner ||
      (metadata?.calendaiPayload !== privateProperties.calendaiPayload && (!legacyPayload || metadata?.calendaiPayload !== legacyPayload))) {
      throw new CalendarProposalConflictError();
    }
    return existing;
  };

  const data = await (async (): Promise<GoogleApiEventResponse> => {
    if (beforeInsert) {
      // Reconcile retries before the guard so changed payloads remain PROPOSAL_CONFLICT.
      if (eventId) {
        const existing = await fetch(`${GOOGLE_CALENDAR_BASE_URL}/calendars/primary/events/${eventId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15000),
          cache: 'no-store',
        });
        if (existing.status === 401) throw new CalendarUnauthorizedError();
        if (await isCalendarPermissionResponse(existing)) throw new CalendarPermissionError();
        if (existing.status === 410) throw new CalendarProposalConflictError();
        if (existing.status !== 404) return reconcile(new Error('Không thể kiểm tra mã đề xuất.'), true, existing);
      }
      await beforeInsert(eventId);
    }
    let response: Response;
    let inserted: GoogleApiEventResponse;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 401) throw new CalendarUnauthorizedError();
      inserted = await response.json() as GoogleApiEventResponse;
    } catch (error) {
      if (error instanceof CalendarUnauthorizedError) throw error;
      if (eventId) return reconcile(error);
      throw error;
    }

    if (!response.ok || inserted.error) {
      if (response.status === 403 && isGoogleCalendarPermissionError(inserted)) {
        throw new CalendarPermissionError();
      }
      const errorMsg = inserted.error?.message || response.statusText;
      const error = new Error(`Google Calendar API Error (${response.status}): ${errorMsg}`);
      if (eventId && (response.status === 409 || response.status >= 500)) {
        return reconcile(error, response.status === 409);
      }
      throw error;
    }
    return inserted;
  })();

  const hangoutLink = extractSafeMeetLink(data);
  const conferenceStatus = data.conferenceData?.createRequest?.status?.statusCode ?? (hangoutLink ? 'success' : undefined);

  return {
    id: data.id,
    summary: data.summary || input.summary,
    description: data.description,
    start: data.start?.dateTime || input.startDateTime,
    end: data.end?.dateTime || input.endDateTime,
    timeZone: data.start?.timeZone || timeZone,
    htmlLink: resolveSafeCalendarHtmlLink(data.htmlLink, data.id),
    hangoutLink,
    conferenceStatus,
    attendees: data.attendees?.map((a) => a.email),
    status: data.status || 'confirmed',
  };
}

const MAX_CALENDAR_PAGES = 100;

export interface ListGoogleCalendarEventsOptions {
  /** Maximum total matching events to return across pages (unlimited when only `pageSize` is set). */
  maxResults?: number;
  /** Google Calendar API `maxResults` page size parameter; defaults to `maxResults` or 10. */
  pageSize?: number;
  timeMin?: string;
  timeMax?: string;
  paginate?: boolean;
  /** Applied before counting toward `maxResults` so post-filtering does not yield short/empty pages. */
  filter?: (event: UpcomingEventItem) => boolean;
}

function extractSafeMeetLink(event: GoogleApiEventResponse): string | undefined {
  const direct = safeHttpsUrl(event.hangoutLink, 'meet');
  if (direct) return direct;
  for (const ep of event.conferenceData?.entryPoints ?? []) {
    if (ep.entryPointType === 'video') {
      const fallback = safeHttpsUrl(ep.uri, 'meet');
      if (fallback) return fallback;
    }
  }
  return undefined;
}

function resolveSafeCalendarHtmlLink(rawHtmlLink: string | undefined, eventId: string): string {
  const direct = safeHttpsUrl(rawHtmlLink, 'calendar');
  if (direct) return direct;
  return eventId ? `https://www.google.com/calendar/event?eid=${encodeURIComponent(eventId)}` : '';
}

function mapGoogleCalendarEvent(event: GoogleApiEventResponse): UpcomingEventItem {
  const hangoutLink = extractSafeMeetLink(event);
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
  const start = event.start?.dateTime || event.start?.date || '';
  const rawEnd = event.end?.dateTime || event.end?.date || '';
  const end = rawEnd || (Number.isFinite(Date.parse(start)) ? start : '');

  return {
    id: event.id,
    summary: event.summary || '(Không có tiêu đề)',
    description: event.description,
    start,
    end,
    hangoutLink,
    htmlLink: resolveSafeCalendarHtmlLink(event.htmlLink, event.id),
    isAllDay,
  };
}

/**
 * Lists Google Calendar events, following `nextPageToken` across short or empty pages
 * until `maxResults` matching events are collected or all pages are exhausted.
 */
export async function listGoogleCalendarEvents(
  accessToken: string,
  options: ListGoogleCalendarEventsOptions = {}
): Promise<UpcomingEventItem[]> {
  const hasPageSize = options.pageSize !== undefined;
  const maxEvents = hasPageSize ? options.maxResults : (options.maxResults ?? 10);
  const pageSize = options.pageSize ?? maxEvents ?? 10;
  const timeMin = options.timeMin || new Date().toISOString();
  const shouldPaginate = options.paginate !== false;

  if (maxEvents !== undefined && maxEvents < 1) {
    return [];
  }

  const queryParams = new URLSearchParams({
    calendarId: 'primary',
    maxResults: String(pageSize),
    timeMin,
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  if (options.timeMax) {
    queryParams.set('timeMax', options.timeMax);
  }

  const events: UpcomingEventItem[] = [];
  const seenPages = new Set<string>();
  const signal = shouldPaginate ? AbortSignal.timeout(15_000) : undefined;

  for (let page = 0; page < MAX_CALENDAR_PAGES; page += 1) {
    const response = await fetch(`${GOOGLE_CALENDAR_BASE_URL}/calendars/primary/events?${queryParams}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(signal ? { signal, cache: 'no-store' } : {}),
    });
    if (response.status === 401) {
      throw new CalendarUnauthorizedError();
    }
    let data: GoogleApiEventsListResponse | null = null;
    try {
      data = (await response.json()) as GoogleApiEventsListResponse;
    } catch (error) {
      if (response.ok) throw error;
    }
    if (response.status === 403 && isGoogleCalendarPermissionError(data)) {
      throw new CalendarPermissionError();
    }
    if (!response.ok || !data || typeof data !== 'object' || Array.isArray(data) || data.error) {
      const errorMsg = data?.error?.message || response.statusText || 'Invalid response';
      throw new Error(`Google Calendar API Error (${response.status}): ${errorMsg}`);
    }
    if (
      (data.items !== undefined && !Array.isArray(data.items)) ||
      (data.nextPageToken !== undefined && typeof data.nextPageToken !== 'string')
    ) {
      throw new Error('Google Calendar returned an invalid response');
    }

    for (const rawEvent of data.items ?? []) {
      const mapped = mapGoogleCalendarEvent(rawEvent);
      if (options.filter && !options.filter(mapped)) continue;
      events.push(mapped);
      if (maxEvents !== undefined && events.length >= maxEvents) {
        return events;
      }
    }

    if (!shouldPaginate || !data.nextPageToken) {
      return events;
    }
    if (seenPages.has(data.nextPageToken)) {
      throw new Error('Google Calendar returned a repeated page');
    }
    seenPages.add(data.nextPageToken);
    queryParams.set('pageToken', data.nextPageToken);
  }

  throw new Error('Google Calendar pagination exceeded maximum page limit');
}
