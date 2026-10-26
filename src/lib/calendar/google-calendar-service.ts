import { createHash } from 'node:crypto';
import { DEFAULT_REMINDER_MINUTES } from './reminders';
import type {
  CalendarEventResult,
  CreateCalendarEventInput,
  UpcomingEventItem,
} from './types';

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

  const url = `${GOOGLE_CALENDAR_BASE_URL}/calendars/primary/events?conferenceDataVersion=1`;

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
      inserted = await response.json() as GoogleApiEventResponse;
    } catch (error) {
      if (eventId) return reconcile(error);
      throw error;
    }

    if (!response.ok || inserted.error) {
      const errorMsg = inserted.error?.message || response.statusText;
      const error = new Error(`Google Calendar API Error (${response.status}): ${errorMsg}`);
      if (eventId && (response.status === 409 || response.status >= 500)) {
        return reconcile(error, response.status === 409);
      }
      throw error;
    }
    return inserted;
  })();

  // Trích xuất Meet link
  let hangoutLink = data.hangoutLink;
  if (!hangoutLink && data.conferenceData?.entryPoints) {
    const videoEntryPoint = data.conferenceData.entryPoints.find(
      (ep) => ep.entryPointType === 'video'
    );
    if (videoEntryPoint?.uri) {
      hangoutLink = videoEntryPoint.uri;
    }
  }

  const conferenceStatus = data.conferenceData?.createRequest?.status?.statusCode ?? (hangoutLink ? 'success' : undefined);

  return {
    id: data.id,
    summary: data.summary || input.summary,
    description: data.description,
    start: data.start?.dateTime || input.startDateTime,
    end: data.end?.dateTime || input.endDateTime,
    timeZone: data.start?.timeZone || timeZone,
    htmlLink: data.htmlLink || `https://www.google.com/calendar/event?eid=${data.id}`,
    hangoutLink,
    conferenceStatus,
    attendees: data.attendees?.map((a) => a.email),
    status: data.status || 'confirmed',
  };
}

export async function listGoogleCalendarEvents(
  accessToken: string,
  options: {
    maxResults?: number;
    timeMin?: string;
    timeMax?: string;
  } = {}
): Promise<UpcomingEventItem[]> {
  const maxResults = options.maxResults || 10;
  const timeMin = options.timeMin || new Date().toISOString();

  const queryParams = new URLSearchParams({
    calendarId: 'primary',
    maxResults: String(maxResults),
    timeMin,
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  if (options.timeMax) {
    queryParams.set('timeMax', options.timeMax);
  }

  const url = `${GOOGLE_CALENDAR_BASE_URL}/calendars/primary/events?${queryParams.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = (await response.json()) as GoogleApiEventsListResponse;

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || response.statusText;
    throw new Error(`Google Calendar API Error (${response.status}): ${errorMsg}`);
  }

  if (!data.items || data.items.length === 0) {
    return [];
  }

  return data.items.map((event) => {
    let hangoutLink = event.hangoutLink;
    if (!hangoutLink && event.conferenceData?.entryPoints) {
      const videoEp = event.conferenceData.entryPoints.find((ep) => ep.entryPointType === 'video');
      if (videoEp?.uri) {
        hangoutLink = videoEp.uri;
      }
    }

    const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);

    return {
      id: event.id,
      summary: event.summary || '(Không có tiêu đề)',
      description: event.description,
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      hangoutLink,
      htmlLink: event.htmlLink || `https://www.google.com/calendar/event?eid=${event.id}`,
      isAllDay,
    };
  });
}
