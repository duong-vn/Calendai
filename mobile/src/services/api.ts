import type { AuthStatus, CalendarEvent, MeetingProposal } from '../types';

export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export async function fetchAuthStatus(baseUrl = DEFAULT_API_URL): Promise<AuthStatus> {
  const res = await fetch(`${baseUrl}/api/auth/google/status`);
  if (!res.ok) throw new Error('Không thể kiểm tra đăng nhập.');
  const data = await res.json();
  if (typeof data.authenticated !== 'boolean' || typeof data.isConfigured !== 'boolean') {
    throw new Error('Phản hồi đăng nhập không hợp lệ.');
  }
  return data;
}

function parseCalendarEvent(value: unknown): CalendarEvent {
  if (!value || typeof value !== 'object' ||
    !('id' in value) || typeof value.id !== 'string' ||
    !('summary' in value) || typeof value.summary !== 'string' ||
    !('start' in value) || typeof value.start !== 'string' ||
    !('end' in value) || typeof value.end !== 'string' ||
    !Number.isFinite(Date.parse(value.start)) || !Number.isFinite(Date.parse(value.end))) {
    throw new Error('Dữ liệu lịch không hợp lệ.');
  }
  return {
    id: value.id,
    summary: value.summary,
    start: value.start,
    end: value.end,
    isAllDay: 'isAllDay' in value && value.isAllDay === true,
    description: 'description' in value && typeof value.description === 'string' ? value.description : undefined,
    hangoutLink: 'hangoutLink' in value && typeof value.hangoutLink === 'string' ? value.hangoutLink : undefined,
  };
}

export async function fetchUpcomingEvents(
  baseUrl = DEFAULT_API_URL
): Promise<{ events: CalendarEvent[]; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/calendar/upcoming`);
    const data = await res.json();
    if (!res.ok || data.success !== true) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Không thể tải lịch.');
    }
    if (data.mode === 'mock') throw new Error('Máy chủ đang dùng lịch mẫu, chưa kết nối Google Calendar.');
    if (!Array.isArray(data.events)) throw new Error('Danh sách lịch không hợp lệ.');
    return { events: data.events.map(parseCalendarEvent) };
  } catch (error) {
    return { events: [], error: error instanceof Error ? error.message : 'Lỗi kết nối máy chủ.' };
  }
}

export async function confirmMeetingProposal(
  baseUrl = DEFAULT_API_URL,
  proposal: MeetingProposal
): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/calendar/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposalId: proposal.proposalId,
        summary: proposal.title,
        startDateTime: proposal.start,
        endDateTime: proposal.end,
        description: proposal.description,
        attendees: proposal.attendees?.map((email) => ({ email })),
        createMeet: proposal.createMeet,
        timeZone: 'Asia/Ho_Chi_Minh',
      }),
    });
    const data = await res.json();
    if (!res.ok || data.success !== true || data.isMock === true) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Chưa tạo được lịch trên Google Calendar.');
    }
    return { success: true, event: parseCalendarEvent(data.event) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Lỗi kết nối máy chủ.' };
  }
}
