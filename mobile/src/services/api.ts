import { isRecord, parseEvent, parseProposal, type AuthStatus, type CalendarEvent, type MeetingProposal, type ModelOption } from '../types';
import { authClient } from './auth';
import { API_ORIGIN, nativeFetch, readJson, type Fetcher } from './transport';

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
  async confirm(proposal: MeetingProposal, signal?: AbortSignal): Promise<CalendarEvent> {
    const data = await readJson(await this.fetcher(`${API_ORIGIN}/api/calendar/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parseProposal(proposal)), signal,
    }));
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
