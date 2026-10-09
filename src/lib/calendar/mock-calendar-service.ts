import type {
  CalendarEventResult,
  CreateCalendarEventInput,
  UpcomingEventItem,
} from './types';

function generateMockMeetCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part3 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part1}-${part2}-${part3}`;
}

const mockStoredEvents: CalendarEventResult[] = [
  {
    id: 'mock-event-1',
    summary: 'Họp Tổng kết Quý 3 (Mock)',
    description: 'Báo cáo kết quả kinh doanh và chỉ số KPI',
    start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    end: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
    timeZone: 'Asia/Ho_Chi_Minh',
    htmlLink: 'https://calendar.google.com/calendar/event?eid=mock1',
    hangoutLink: 'https://meet.google.com/abc-defg-hij',
    conferenceStatus: 'success',
    attendees: ['team@example.com'],
    status: 'confirmed',
  },
];

export async function createMockCalendarEvent(
  input: CreateCalendarEventInput
): Promise<CalendarEventResult> {
  const id = `mock-event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timeZone = input.timeZone || 'Asia/Ho_Chi_Minh';
  const shouldCreateMeet = input.createMeet !== false;
  const meetCode = generateMockMeetCode();
  const hangoutLink = shouldCreateMeet ? `https://meet.google.com/${meetCode}` : undefined;

  const newEvent: CalendarEventResult = {
    id,
    summary: input.summary,
    description: input.description,
    start: input.startDateTime,
    end: input.endDateTime,
    timeZone,
    htmlLink: `https://calendar.google.com/calendar/event?eid=${id}`,
    hangoutLink,
    conferenceStatus: shouldCreateMeet ? 'success' : undefined,
    attendees: input.attendees?.map((a) => a.email),
    status: 'confirmed',
  };

  mockStoredEvents.push(newEvent);
  return newEvent;
}

export async function listMockCalendarEvents(): Promise<UpcomingEventItem[]> {
  return mockStoredEvents.map((evt) => ({
    id: evt.id,
    summary: evt.summary,
    description: evt.description,
    start: evt.start,
    end: evt.end,
    hangoutLink: evt.hangoutLink,
    htmlLink: evt.htmlLink,
    isAllDay: false,
  }));
}
