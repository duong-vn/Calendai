export interface CalendarAttendee {
  email: string;
  displayName?: string;
}

export interface CreateCalendarEventInput {
  summary: string;
  description?: string;
  startDateTime: string; // ISO 8601
  endDateTime: string;   // ISO 8601
  timeZone?: string;     // Default 'Asia/Ho_Chi_Minh'
  attendees?: CalendarAttendee[];
  createMeet?: boolean;  // Default true
}

export interface CalendarEventResult {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  timeZone: string;
  htmlLink: string;
  hangoutLink?: string;
  conferenceStatus?: 'success' | 'pending' | 'failure';
  attendees?: string[];
  status: string;
}

export interface UpcomingEventItem {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  hangoutLink?: string;
  htmlLink: string;
  isAllDay: boolean;
}
