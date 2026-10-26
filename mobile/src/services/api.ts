import { isRecord, parseEvent, parseProposal, type AuthStatus, type CalendarEvent, type MeetingProposal, type ModelOption } from '../types';
import { authClient } from './auth';
import { API_ORIGIN, nativeFetch, readJson, type Fetcher } from './transport';

export interface CalendarConflict {
  id: string;
  summary: string;
  start: string;
  end: string;
  etag: string;
  timeZone: string;
  isAllDay: boolean;
}

export function parseConflicts(data: unknown): CalendarConflict[] {
  if (!isRecord(data) || !Array.isArray(data.conflicts)) throw new Error('Dữ liệu xung đột lịch không hợp lệ.');
  return data.conflicts.map((item: unknown) => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.summary !== 'string' ||
      typeof item.start !== 'string' || typeof item.end !== 'string' || typeof item.etag !== 'string' ||
      typeof item.timeZone !== 'string' || typeof item.isAllDay !== 'boolean' ||
      !Number.isFinite(Date.parse(item.start)) || !Number.isFinite(Date.parse(item.end))) throw new Error('Dữ liệu xung đột lịch không hợp lệ.');
    try { new Intl.DateTimeFormat('vi-VN', { timeZone: item.timeZone }); }
    catch { throw new Error('Múi giờ xung đột lịch không hợp lệ.'); }
    return { id: item.id, summary: item.summary, start: item.start, end: item.end, etag: item.etag, timeZone: item.timeZone, isAllDay: item.isAllDay };
  });
}

export class CalendarConflictError extends Error {
  constructor(readonly conflicts: CalendarConflict[]) { super('Khung giờ này trùng với lịch có sẵn.'); }
}

export class MobileApi {
  constructor(private readonly fetcher: Fetcher = authClient.fetch) {}
  async status(signal?: AbortSignal): Promise<AuthStatus> {
    const data = await readJson(await this.fetcher(`${API_ORIGIN}/api/auth/google/status`, { signal }));
    if (!isRecord(data) || typeof data.authenticated !== 'boolean' || typeof data.isConfigured !== 'boolean') throw new Error('Trạng thái đăng nhập không hợp lệ.');
    return { authenticated: data.authenticated, isConfigured: data.isConfigured, user: isRecord(data.user) ? {
      email: typeof data.user.email === 'string' ? data.user.email : undefined,
      name: typeof data.user.name === 'string' ? data.user.name : undefined,
    } : null };
  }
  async upcoming(signal?: AbortSignal): Promise<CalendarEvent[]> {
    const data = await readJson(await this.fetcher(`${API_ORIGIN}/api/calendar/upcoming`, { signal }));
    if (!isRecord(data) || data.success !== true || data.mode === 'mock' || !Array.isArray(data.events)) throw new Error('Chưa tải được lịch thật từ Google Calendar. Vui lòng thử lại.');
    return data.events.map(parseEvent);
  }
  async conflicts(proposal: MeetingProposal, signal?: AbortSignal): Promise<CalendarConflict[]> {
    const data = await readJson(await this.fetcher(`${API_ORIGIN}/api/calendar/conflicts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parseProposal(proposal)), signal,
    }));
    return parseConflicts(data);
  }
  async resolveConflict(proposal: MeetingProposal, conflict: CalendarConflict, action: 'cancel' | 'reschedule', times?: { startDateTime: string; endDateTime: string }): Promise<void> {
    const data = await readJson(await this.fetcher(`${API_ORIGIN}/api/calendar/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal: parseProposal(proposal), eventId: conflict.id, etag: conflict.etag, action, ...times }),
    }));
    if (!isRecord(data) || data.success !== true) throw new Error('Chưa cập nhật được lịch cũ.');
  }
  async confirm(proposal: MeetingProposal, signal?: AbortSignal, allowConflict = false): Promise<CalendarEvent> {
    const response = await this.fetcher(`${API_ORIGIN}/api/calendar/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...parseProposal(proposal), allowConflict }), signal,
    });
    if (response.status === 409) {
      const body: unknown = await response.json();
      if (isRecord(body) && body.code === 'CALENDAR_CONFLICT') throw new CalendarConflictError(parseConflicts(body));
      throw new Error('Bản thảo đã thay đổi hoặc lịch đã được cập nhật. Vui lòng kiểm tra lại.');
    }
    const data = await readJson(response);
    if (!isRecord(data) || data.success !== true || data.isMock === true) throw new Error('Chưa xác nhận được sự kiện trên Google Calendar. Giữ nguyên bản thảo và thử lại.');
    return parseEvent(data.event);
  }
}
export const mobileApi = new MobileApi();

export async function fetchModels(signal?: AbortSignal): Promise<{ models: ModelOption[]; defaultModel: string }> {
  const data = await readJson(await nativeFetch(`${API_ORIGIN}/api/models`, { signal }));
  if (!isRecord(data) || !Array.isArray(data.models)) throw new Error('Không thể tải danh sách mô hình.');
  const models = data.models.flatMap((model): ModelOption[] => isRecord(model) && typeof model.id === 'string' && typeof model.name === 'string' ? [{
    id: model.id, name: model.name, provider: typeof model.provider === 'string' ? model.provider : '',
    supportsTools: model.supportsTools === true, isFree: model.isFree === true,
  }] : []);
  return { models, defaultModel: typeof data.defaultModel === 'string' ? data.defaultModel : '' };
}
