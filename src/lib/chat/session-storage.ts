import type { Message } from 'ai';
import type { CalendarEventResult, CreateCalendarEventInput } from '@/lib/calendar/types';

export interface MeetingConfirmationPayload extends Omit<CreateCalendarEventInput, 'attendees'> {
  attendees: Array<{ email: string; name?: string }>;
  proposalId: string;
  allowConflict: boolean;
  createMeet: boolean;
  reminderMinutes: number[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  confirmedEvents: Record<string, { event: CalendarEventResult; isMock?: boolean }>;
  model?: string;
  confirmationPayloads?: Record<string, MeetingConfirmationPayload>;
  confirmationAttempts?: Record<string, string>;
}

interface StorageKeys {
  SESSIONS: string;
  ACTIVE_ID: string;
  LEGACY_MESSAGES: string;
  LEGACY_EVENTS: string;
}

function getStorageKeys(scope?: string | null): StorageKeys {
  const prefix = scope ? `calendai_${scope}` : 'calendai';
  return {
    SESSIONS: `${prefix}_chat_sessions`,
    ACTIVE_ID: `${prefix}_active_session_id`,
    LEGACY_MESSAGES: `${prefix}_chat_messages`,
    LEGACY_EVENTS: `${prefix}_confirmed_events`,
  };
}

function isValidSession(s: unknown): s is ChatSession {
  if (!s || typeof s !== 'object') return false;
  const session = s as Record<string, unknown>;
  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    typeof session.createdAt === 'number' &&
    typeof session.updatedAt === 'number' &&
    Array.isArray(session.messages) &&
    typeof session.confirmedEvents === 'object' &&
    session.confirmedEvents !== null
  );
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function deriveSessionTitle(messages: Message[]): string {
  const firstUserMsg = messages.find((m) => m.role === 'user' && m.content?.trim());
  if (!firstUserMsg) return 'Cuộc trò chuyện mới';
  const clean = firstUserMsg.content.trim().replace(/\s+/g, ' ');
  return clean.length > 40 ? `${clean.substring(0, 37)}...` : clean;
}

export function loadAllSessions(scope?: string | null): ChatSession[] {
  if (typeof window === 'undefined') return [];

  const keys = getStorageKeys(scope);
  try {
    const raw = localStorage.getItem(keys.SESSIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(isValidSession);
      }
    }

    // Check legacy single-session storage
    const legacyRawMessages = localStorage.getItem(keys.LEGACY_MESSAGES);
    if (legacyRawMessages) {
      const messages: Message[] = JSON.parse(legacyRawMessages);
      if (Array.isArray(messages) && messages.length > 0) {
        let confirmedEvents = {};
        try {
          const legacyEvents = localStorage.getItem(keys.LEGACY_EVENTS);
          if (legacyEvents) confirmedEvents = JSON.parse(legacyEvents);
        } catch {
          // Ignore parse errors
        }

        const legacySession: ChatSession = {
          id: generateSessionId(),
          title: deriveSessionTitle(messages),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages,
          confirmedEvents,
        };

        saveSessionsList([legacySession], scope);
        setActiveSessionId(legacySession.id, scope);
        return [legacySession];
      }
    }
  } catch {
    // Ignore parse errors
  }

  return [];
}

export const SESSION_CONFIRMATION_CHANGED_EVENT = 'calendai:session-confirmation-changed';

export interface SessionConfirmationChangedDetail {
  scope: string | null;
  sessionId: string;
}

function notifySessionConfirmationChanged(sessionId: string, scope?: string | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SessionConfirmationChangedDetail>(SESSION_CONFIRMATION_CHANGED_EVENT, {
    detail: { scope: scope ?? null, sessionId },
  }));
}

export function saveSessionsList(sessions: ChatSession[], scope?: string | null): void {
  if (typeof window === 'undefined') return;
  const keys = getStorageKeys(scope);
  try {
    localStorage.setItem(keys.SESSIONS, JSON.stringify(sessions));
  } catch {
    // Ignore quota errors
  }
}

export function saveConfirmedEvent(
  sessionId: string,
  proposalId: string,
  event: CalendarEventResult,
  isMock?: boolean,
  scope?: string | null,
): boolean {
  if (typeof window === 'undefined') return false;
  const sessions = loadAllSessions(scope);
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return false;
  session.confirmedEvents = { ...session.confirmedEvents, [proposalId]: { event, isMock } };
  session.updatedAt = Date.now();
  saveSessionsList(sessions, scope);
  notifySessionConfirmationChanged(sessionId, scope);
  return true;
}

export function saveConfirmationPayload(
  sessionId: string,
  payload: MeetingConfirmationPayload,
  scope?: string | null,
): () => boolean {
  const sessions = loadAllSessions(scope);
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) throw new Error('Không tìm thấy cuộc trò chuyện. Vui lòng tải lại trước khi xác nhận.');
  const { proposalId } = payload;
  const firstAttempt = !session.confirmationPayloads?.[proposalId];
  const attemptId = crypto.getRandomValues(new Uint32Array(4)).join('-');
  session.confirmationPayloads = { ...session.confirmationPayloads, [proposalId]: payload };
  session.confirmationAttempts = { ...session.confirmationAttempts, [proposalId]: attemptId };
  const key = getStorageKeys(scope).SESSIONS;
  // Unlike history autosave, this write must succeed before a calendar mutation.
  localStorage.setItem(key, JSON.stringify(sessions));
  notifySessionConfirmationChanged(sessionId, scope);

  return () => {
    if (!firstAttempt) return false;
    const latest = loadAllSessions(scope);
    const current = latest.find((item) => item.id === sessionId);
    // A late rejection must not clear a more recent attempt's recovery payload.
    if (!current?.confirmationPayloads || current.confirmationAttempts?.[proposalId] !== attemptId) return false;
    delete current.confirmationPayloads[proposalId];
    delete current.confirmationAttempts[proposalId];
    localStorage.setItem(key, JSON.stringify(latest));
    notifySessionConfirmationChanged(sessionId, scope);
    return true;
  };
}

export function getActiveSessionId(scope?: string | null): string | null {
  if (typeof window === 'undefined') return null;
  const keys = getStorageKeys(scope);
  try {
    return localStorage.getItem(keys.ACTIVE_ID);
  } catch {
    return null;
  }
}

export function setActiveSessionId(id: string, scope?: string | null): void {
  if (typeof window === 'undefined') return;
  const keys = getStorageKeys(scope);
  try {
    localStorage.setItem(keys.ACTIVE_ID, id);
  } catch {
    // Ignore
  }
}

export function saveCurrentSession(session: ChatSession, scope?: string | null): void {
  if (typeof window === 'undefined') return;

  const keys = getStorageKeys(scope);
  const sessions = loadAllSessions(scope);
  const existingIdx = sessions.findIndex((s) => s.id === session.id);

  if (existingIdx >= 0) {
    sessions[existingIdx] = session;
  } else {
    sessions.unshift(session);
  }

  saveSessionsList(sessions, scope);
  setActiveSessionId(session.id, scope);

  // Maintain backward-compatibility with single-session legacy keys
  try {
    localStorage.setItem(keys.LEGACY_MESSAGES, JSON.stringify(session.messages));
    localStorage.setItem(keys.LEGACY_EVENTS, JSON.stringify(session.confirmedEvents));
  } catch {
    // Ignore
  }
}

export function createNewSession(model?: string, scope?: string | null): ChatSession {
  const newSession: ChatSession = {
    id: generateSessionId(),
    title: 'Cuộc trò chuyện mới',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    confirmedEvents: {},
    model,
  };

  const keys = getStorageKeys(scope);
  const sessions = loadAllSessions(scope);
  sessions.unshift(newSession);
  saveSessionsList(sessions, scope);
  setActiveSessionId(newSession.id, scope);

  try {
    localStorage.setItem(keys.LEGACY_MESSAGES, JSON.stringify([]));
    localStorage.setItem(keys.LEGACY_EVENTS, JSON.stringify({}));
  } catch {
    // Ignore
  }

  return newSession;
}

export function deleteSessionById(sessionId: string, scope?: string | null): {
  remainingSessions: ChatSession[];
  newActiveId: string | null;
} {
  const keys = getStorageKeys(scope);
  const sessions = loadAllSessions(scope).filter((s) => s.id !== sessionId);
  saveSessionsList(sessions, scope);

  let newActiveId = getActiveSessionId(scope);
  if (newActiveId === sessionId) {
    newActiveId = sessions[0]?.id || null;
    if (newActiveId) {
      setActiveSessionId(newActiveId, scope);
      const active = sessions.find((s) => s.id === newActiveId);
      if (active) {
        try {
          localStorage.setItem(keys.LEGACY_MESSAGES, JSON.stringify(active.messages));
          localStorage.setItem(keys.LEGACY_EVENTS, JSON.stringify(active.confirmedEvents));
        } catch {
          // Ignore
        }
      }
    } else {
      try {
        localStorage.removeItem(keys.ACTIVE_ID);
        localStorage.removeItem(keys.LEGACY_MESSAGES);
        localStorage.removeItem(keys.LEGACY_EVENTS);
      } catch {
        // Ignore
      }
    }
  }

  return { remainingSessions: sessions, newActiveId };
}
