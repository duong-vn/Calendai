import type { Message } from 'ai';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface MobileSession {
  session: string;
  user: UserProfile;
  expiresAt: number;
  accessTokenExpiresAt: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  timeZone?: string;
  isAllDay?: boolean;
  hangoutLink?: string;
  htmlLink?: string;
  meetStatus?: 'pending' | 'success' | 'failure';
}

export interface MeetingProposal {
  proposalId: string;
  summary: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  attendees: Array<{ email: string; name?: string }>;
  description?: string;
  createMeet: boolean;
}

export interface AuthStatus {
  authenticated: boolean;
  user: { email?: string; name?: string; picture?: string } | null;
  isConfigured: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  supportsTools: boolean;
  isFree: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
  confirmed: Record<string, CalendarEvent>;
  submitted: Record<string, MeetingProposal>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseSession(value: unknown): MobileSession {
  if (!isRecord(value) || !isRecord(value.user)) throw new Error('Phiên đăng nhập không hợp lệ.');
  const expiry = (input: unknown): number => typeof input === 'number' ? input : typeof input === 'string' ? Date.parse(input) : NaN;
  const expiresAt = expiry(value.expiresAt);
  const accessTokenExpiresAt = expiry(value.accessTokenExpiresAt);
  if (typeof value.session !== 'string' || value.session.length < 20 || value.session.length > 16000 ||
      typeof value.user.id !== 'string' || !value.user.id || typeof value.user.email !== 'string' ||
      !Number.isFinite(expiresAt) || !Number.isFinite(accessTokenExpiresAt)) {
    throw new Error('Phiên đăng nhập không hợp lệ.');
  }
  return {
    session: value.session,
    user: {
      id: value.user.id,
      email: value.user.email,
      name: typeof value.user.name === 'string' ? value.user.name : undefined,
      picture: typeof value.user.picture === 'string' ? value.user.picture : undefined,
    },
    expiresAt,
    accessTokenExpiresAt,
  };
}

export function parseEvent(value: unknown): CalendarEvent {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.summary !== 'string' ||
      typeof value.start !== 'string' || typeof value.end !== 'string' ||
      !Number.isFinite(Date.parse(value.start)) || !Number.isFinite(Date.parse(value.end))) {
    throw new Error('Dữ liệu Google Calendar không hợp lệ.');
  }
  return {
    id: value.id, summary: value.summary, start: value.start, end: value.end,
    isAllDay: value.isAllDay === true,
    description: typeof value.description === 'string' ? value.description : undefined,
    timeZone: typeof value.timeZone === 'string' ? value.timeZone : undefined,
    hangoutLink: typeof value.hangoutLink === 'string' ? value.hangoutLink : undefined,
    htmlLink: typeof value.htmlLink === 'string' ? value.htmlLink : undefined,
    meetStatus: value.conferenceStatus === 'pending' || value.conferenceStatus === 'failure' || value.conferenceStatus === 'success' ? value.conferenceStatus :
      value.meetStatus === 'pending' || value.meetStatus === 'failure' || value.meetStatus === 'success' ? value.meetStatus : undefined,
  };
}

export function parseProposal(value: unknown): MeetingProposal {
  if (!isRecord(value) || typeof value.proposalId !== 'string' || !value.proposalId || value.proposalId.length > 200 ||
      typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 200 ||
      typeof value.startDateTime !== 'string' || typeof value.endDateTime !== 'string' ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(value.startDateTime) || !/(Z|[+-]\d{2}:\d{2})$/.test(value.endDateTime) ||
      !Number.isFinite(Date.parse(value.startDateTime)) || Date.parse(value.endDateTime) <= Date.parse(value.startDateTime) ||
      !Number.isFinite(Date.parse(value.endDateTime))) throw new Error('Bản thảo chưa hợp lệ. Hãy yêu cầu trợ lý tạo lại.');
  const timeZone = typeof value.timeZone === 'string' ? value.timeZone : 'Asia/Ho_Chi_Minh';
  try { new Intl.DateTimeFormat('vi-VN', { timeZone }).format(); } catch { throw new Error('Múi giờ bản thảo không hợp lệ.'); }
  const attendees = value.attendees ?? [];
  if (!Array.isArray(attendees) || attendees.length > 100 || attendees.some(a => !isRecord(a) || typeof a.email !== 'string' || a.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email))) {
    throw new Error('Danh sách khách mời không hợp lệ.');
  }
  return {
    proposalId: value.proposalId, summary: value.summary,
    startDateTime: value.startDateTime, endDateTime: value.endDateTime, timeZone,
    attendees: attendees.map(a => ({ email: String(a.email), name: typeof a.name === 'string' ? a.name : undefined })),
    createMeet: value.createMeet === true,
    description: typeof value.description === 'string' ? value.description : undefined,
  };
}
