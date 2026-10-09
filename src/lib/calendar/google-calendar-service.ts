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

export async function createGoogleCalendarEvent(
  accessToken: string,
  input: CreateCalendarEventInput
): Promise<CalendarEventResult> {
  const timeZone = input.timeZone || 'Asia/Ho_Chi_Minh';
  const shouldCreateMeet = input.createMeet !== false;
  const requestId = crypto.randomUUID();

  const url = `${GOOGLE_CALENDAR_BASE_URL}/calendars/primary/events?conferenceDataVersion=1`;

  const requestBody: Record<string, unknown> = {
    summary: input.summary,
    description: input.description ?? '',
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

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = (await response.json()) as GoogleApiEventResponse;

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || response.statusText;
    throw new Error(`Google Calendar API Error (${response.status}): ${errorMsg}`);
  }

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
