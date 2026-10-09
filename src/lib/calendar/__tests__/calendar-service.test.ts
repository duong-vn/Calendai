import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGoogleCalendarEvent,
  listGoogleCalendarEvents,
} from '../google-calendar-service';
import {
  createMockCalendarEvent,
  listMockCalendarEvents,
} from '../mock-calendar-service';

describe('Google Calendar Service Layer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates Google Calendar event with Google Meet successfully', async () => {
    const mockApiResponse = {
      id: 'google-event-id-999',
      summary: 'Họp Kế hoạch Tuần',
      description: 'Nội dung chi tiết',
      status: 'confirmed',
      htmlLink: 'https://calendar.google.com/event?id=999',
      hangoutLink: 'https://meet.google.com/abc-defg-hij',
      start: {
        dateTime: '2026-10-12T09:00:00+07:00',
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      end: {
        dateTime: '2026-10-12T10:00:00+07:00',
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      attendees: [{ email: 'partner@example.com' }],
      conferenceData: {
        createRequest: {
          requestId: 'test-uuid',
          status: { statusCode: 'success' },
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await createGoogleCalendarEvent('mock-access-token', {
      summary: 'Họp Kế hoạch Tuần',
      description: 'Nội dung chi tiết',
      startDateTime: '2026-10-12T09:00:00+07:00',
      endDateTime: '2026-10-12T10:00:00+07:00',
      timeZone: 'Asia/Ho_Chi_Minh',
      attendees: [{ email: 'partner@example.com' }],
      createMeet: true,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    const calledOptions = mockFetch.mock.calls[0][1];

    expect(calledUrl).toContain('conferenceDataVersion=1');
    expect(calledOptions.headers.Authorization).toBe('Bearer mock-access-token');

    const parsedBody = JSON.parse(calledOptions.body);
    expect(parsedBody.summary).toBe('Họp Kế hoạch Tuần');
    expect(parsedBody.conferenceData?.createRequest?.conferenceSolutionKey?.type).toBe('hangoutsMeet');

    expect(result.id).toBe('google-event-id-999');
    expect(result.hangoutLink).toBe('https://meet.google.com/abc-defg-hij');
    expect(result.conferenceStatus).toBe('success');
  });

  it('falls back to entryPoints video uri when top-level hangoutLink is absent', async () => {
    const mockApiResponse = {
      id: 'google-event-id-888',
      summary: 'Họp Khẩn',
      htmlLink: 'https://calendar.google.com/event?id=888',
      start: { dateTime: '2026-10-12T09:00:00+07:00' },
      end: { dateTime: '2026-10-12T10:00:00+07:00' },
      conferenceData: {
        entryPoints: [
          { entryPointType: 'video', uri: 'https://meet.google.com/fallback-meet-uri' },
        ],
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }));

    const result = await createGoogleCalendarEvent('mock-token', {
      summary: 'Họp Khẩn',
      startDateTime: '2026-10-12T09:00:00+07:00',
      endDateTime: '2026-10-12T10:00:00+07:00',
    });

    expect(result.hangoutLink).toBe('https://meet.google.com/fallback-meet-uri');
  });

  it('throws descriptive error when Google API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        error: { message: 'Invalid Credentials', code: 401 },
      }),
    }));

    await expect(
      createGoogleCalendarEvent('expired-token', {
        summary: 'Test',
        startDateTime: '2026-10-12T09:00:00+07:00',
        endDateTime: '2026-10-12T10:00:00+07:00',
      })
    ).rejects.toThrow('Google Calendar API Error (401): Invalid Credentials');
  });

  it('lists upcoming events accurately', async () => {
    const mockApiResponse = {
      items: [
        {
          id: 'event-1',
          summary: 'Review Code',
          start: { dateTime: '2026-10-12T14:00:00+07:00' },
          end: { dateTime: '2026-10-12T15:00:00+07:00' },
          hangoutLink: 'https://meet.google.com/xyz-test-meet',
          htmlLink: 'https://calendar.google.com/event?id=event-1',
        },
      ],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }));

    const events = await listGoogleCalendarEvents('valid-token', { maxResults: 5 });
    expect(events.length).toBe(1);
    expect(events[0].summary).toBe('Review Code');
    expect(events[0].hangoutLink).toBe('https://meet.google.com/xyz-test-meet');
    expect(events[0].isAllDay).toBe(false);
  });
});

describe('Mock Calendar Service', () => {
  it('creates mock events with valid meet links and attributes', async () => {
    const mockEvent = await createMockCalendarEvent({
      summary: 'Mock Meeting Demo',
      startDateTime: '2026-10-15T10:00:00+07:00',
      endDateTime: '2026-10-15T11:00:00+07:00',
      attendees: [{ email: 'demo@example.com' }],
      createMeet: true,
    });

    expect(mockEvent.id).toContain('mock-event-');
    expect(mockEvent.summary).toBe('Mock Meeting Demo');
    expect(mockEvent.hangoutLink).toMatch(/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
    expect(mockEvent.conferenceStatus).toBe('success');
  });

  it('lists mock events correctly', async () => {
    const list = await listMockCalendarEvents();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].summary).toBeDefined();
  });
});
