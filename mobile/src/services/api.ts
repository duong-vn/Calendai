import { isRecord, parseEvent, parseProposal, type AuthStatus, type CalendarEvent, type MeetingProposal, type ModelOption } from '../types';
import { authClient } from './auth';
import { API_ORIGIN, ApiError, nativeFetch, readJson, type Fetcher } from './transport';

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
  constructor(
    readonly conflicts: CalendarConflict[],
    message = 'Khung giờ này trùng với lịch có sẵn.',
  ) {
    super(message);
  }
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
    const response = await this.fetcher(`${API_ORIGIN}/api/calendar/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal: parseProposal(proposal), eventId: conflict.id, etag: conflict.etag, action, ...times }),
    });
    if (response.status === 409) {
      let body: unknown = null;
      try { body = await response.json(); } catch { body = null; }
      if (isRecord(body) && body.code === 'CALENDAR_CONFLICT') {
        let overlaps: CalendarConflict[] = [];
        if (Array.isArray(body.conflicts)) {
          try { overlaps = parseConflicts(body); } catch { overlaps = []; }
        }
        const overlapsDraft = overlaps.length === 1 && overlaps[0].id === conflict.id;
        throw new CalendarConflictError(
          overlaps,
          overlapsDraft
            ? 'Giờ mới vẫn trùng với bản thảo đang tạo. Vui lòng chọn khung giờ khác hoặc giữ lịch cũ.'
            : 'Giờ mới vẫn trùng với lịch hiện có hoặc bản thảo đang tạo. Vui lòng chọn khung giờ khác hoặc giữ lịch cũ.',
        );
      }
      const code = isRecord(body) && typeof body.code === 'string' ? body.code : 'STALE_EVENT';
      throw new ApiError(
        'Sự kiện đã thay đổi hoặc không còn trùng lịch. Vui lòng kiểm tra lại xung đột trước khi tiếp tục.',
        409,
        code,
      );
    }
    if (response.status === 400) {
      let body: unknown = null;
      try { body = await response.json(); } catch { body = null; }
      const code = isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
      const isRecurring =
        code === 'RECURRING_EVENT' ||
        (isRecord(body) && typeof body.error === 'string' && body.error.includes('chuỗi sự kiện'));
      throw new ApiError(
        isRecurring
          ? 'Không thể thay đổi cả chuỗi sự kiện. Vui lòng chọn một lần diễn ra cụ thể.'
          : 'Ngày giờ hoặc thông tin thay đổi lịch không hợp lệ. Vui lòng kiểm tra lại.',
        400,
        code ?? (isRecurring ? 'RECURRING_EVENT' : 'INVALID_INPUT'),
      );
    }
    const data = await readJson(response);
    if (!isRecord(data) || data.success !== true) throw new Error('Chưa cập nhật được lịch cũ.');
  }
  async confirm(proposal: MeetingProposal, signal?: AbortSignal, allowConflict = false): Promise<CalendarEvent> {
    const response = await this.fetcher(`${API_ORIGIN}/api/calendar/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...parseProposal(proposal), allowConflict }), signal,
    });
    if (response.status === 409) {
      const body: unknown = await response.json();
      if (isRecord(body) && body.code === 'CALENDAR_CONFLICT') {
        const conflicts = parseConflicts(body);
        if (conflicts.length > 0) throw new CalendarConflictError(conflicts);
      }
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
