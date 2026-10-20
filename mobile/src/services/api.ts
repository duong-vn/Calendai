import type { AuthStatus, CalendarEvent, MeetingProposal } from '../types';

export const DEFAULT_API_URL = 'http://localhost:3000';

export async function fetchAuthStatus(baseUrl = DEFAULT_API_URL): Promise<AuthStatus> {
  try {
    const res = await fetch(`${baseUrl}/api/auth/google/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Không thể kiểm tra đăng nhập');
    return await res.json();
  } catch {
    return {
      authenticated: false,
      user: null,
      isConfigured: true,
    };
  }
}

export async function fetchUpcomingEvents(
  baseUrl = DEFAULT_API_URL
): Promise<{ events: CalendarEvent[]; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/calendar/upcoming`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { events: [], error: data.error || 'Chưa kết nối Google Calendar' };
    }
    const data = await res.json();
    return { events: data.events || [] };
  } catch {
    return {
      events: [
        {
          id: 'demo-1',
          summary: 'Review UI Mobile Calendai',
          start: { dateTime: new Date(Date.now() + 3600000).toISOString() },
          end: { dateTime: new Date(Date.now() + 7200000).toISOString() },
          hangoutLink: 'https://meet.google.com/abc-defg-hij',
        },
        {
          id: 'demo-2',
          summary: 'Họp đồng bộ backend API Next.js',
          start: { dateTime: new Date(Date.now() + 14400000).toISOString() },
          end: { dateTime: new Date(Date.now() + 18000000).toISOString() },
          hangoutLink: 'https://meet.google.com/xyz-uvwx-rst',
        },
      ],
    };
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
      body: JSON.stringify(proposal),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Lỗi khi xác nhận lịch' };
    }
    return { success: true, event: data.event };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi kết nối máy chủ',
    };
  }
}
