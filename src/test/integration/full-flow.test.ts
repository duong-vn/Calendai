import { describe, expect, it, vi } from 'vitest';
import { createCalendarTools } from '@/lib/ai/tools';
import { createGoogleCalendarEvent } from '@/lib/calendar/google-calendar-service';

describe('End-to-End Meeting Creation Flow (Integration)', () => {
  it('processes proposal tool execution and creates confirmed Google event with Meet link', async () => {
    // 1. Giả lập AI Model gọi tool proposeMeeting
    const tools = createCalendarTools();
    const proposeExecute = tools.proposeMeeting.execute;
    expect(proposeExecute).toBeDefined();

    const proposal = await proposeExecute!(
      {
        summary: 'Demo Ra Mắt Calendai',
        description: 'Giới thiệu tính năng AI đặt lịch tiếng Việt với Google Meet',
        startDateTime: '2026-10-20T10:00:00+07:00',
        endDateTime: '2026-10-20T11:00:00+07:00',
        timeZone: 'Asia/Ho_Chi_Minh',
        attendees: [{ email: 'partner@example.com' }],
        createMeet: true,
      },
      { toolCallId: 'call-e2e', messages: [] }
    );

    expect(proposal.proposalId).toBeDefined();
    expect(proposal.summary).toBe('Demo Ra Mắt Calendai');
    expect(proposal.createMeet).toBe(true);

    // 2. Giả lập Google Calendar API phản hồi
    const mockGoogleResponse = {
      id: 'g-event-real-123',
      summary: proposal.summary,
      description: proposal.description,
      status: 'confirmed',
      htmlLink: 'https://calendar.google.com/event?id=g-event-real-123',
      hangoutLink: 'https://meet.google.com/abc-xyzm-opq',
      start: {
        dateTime: proposal.startDateTime,
        timeZone: proposal.timeZone,
      },
      end: {
        dateTime: proposal.endDateTime,
        timeZone: proposal.timeZone,
      },
      attendees: proposal.attendees,
      conferenceData: {
        createRequest: {
          requestId: 'req-e2e-1',
          status: { statusCode: 'success' },
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGoogleResponse,
    });
    vi.stubGlobal('fetch', mockFetch);

    // 3. Gọi dịch vụ tạo lịch (mô phỏng xác nhận trên UI)
    const createdEvent = await createGoogleCalendarEvent('valid-user-access-token', {
      summary: proposal.summary,
      description: proposal.description,
      startDateTime: proposal.startDateTime,
      endDateTime: proposal.endDateTime,
      timeZone: proposal.timeZone,
      attendees: proposal.attendees,
      createMeet: proposal.createMeet,
    });

    // 4. Kiểm tra sự kiện được tạo
    expect(createdEvent.id).toBe('g-event-real-123');
    expect(createdEvent.summary).toBe('Demo Ra Mắt Calendai');
    expect(createdEvent.hangoutLink).toBe('https://meet.google.com/abc-xyzm-opq');
    expect(createdEvent.conferenceStatus).toBe('success');
    expect(createdEvent.htmlLink).toContain('calendar.google.com');
  });
});
