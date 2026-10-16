import type { Message } from 'ai';
import type { CalendarEventResult } from '@/lib/calendar/types';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  confirmedEvents: Record<string, { event: CalendarEventResult; isMock?: boolean }>;
  model?: string;
}

const STORAGE_KEYS = {
  SESSIONS: 'calendai_chat_sessions',
  ACTIVE_ID: 'calendai_active_session_id',
  LEGACY_MESSAGES: 'calendai_chat_messages',
  LEGACY_EVENTS: 'calendai_confirmed_events',
} as const;

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function deriveSessionTitle(messages: Message[]): string {
  const firstUserMsg = messages.find((m) => m.role === 'user' && m.content?.trim());
  if (!firstUserMsg) return 'Cuộc trò chuyện mới';
  const clean = firstUserMsg.content.trim().replace(/\s+/g, ' ');
  return clean.length > 40 ? `${clean.substring(0, 37)}...` : clean;
}

export function loadAllSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Check legacy single-session storage
    const legacyRawMessages = localStorage.getItem(STORAGE_KEYS.LEGACY_MESSAGES);
    if (legacyRawMessages) {
      const messages: Message[] = JSON.parse(legacyRawMessages);
      if (Array.isArray(messages) && messages.length > 0) {
        let confirmedEvents = {};
        try {
          const legacyEvents = localStorage.getItem(STORAGE_KEYS.LEGACY_EVENTS);
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

        saveSessionsList([legacySession]);
        setActiveSessionId(legacySession.id);
        return [legacySession];
      }
    }
  } catch {
    // Ignore parse errors
  }

  return [];
}

export function saveSessionsList(sessions: ChatSession[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  } catch {
    // Ignore quota errors
  }
}

export function getActiveSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
}

export function setActiveSessionId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, id);
  } catch {
    // Ignore
  }
}

export function saveCurrentSession(session: ChatSession): void {
  if (typeof window === 'undefined') return;

  const sessions = loadAllSessions();
  const existingIdx = sessions.findIndex((s) => s.id === session.id);

  if (existingIdx >= 0) {
    sessions[existingIdx] = session;
  } else {
    sessions.unshift(session);
  }

  saveSessionsList(sessions);
  setActiveSessionId(session.id);

  // Maintain backward-compatibility with single-session legacy keys
  try {
    localStorage.setItem(STORAGE_KEYS.LEGACY_MESSAGES, JSON.stringify(session.messages));
    localStorage.setItem(STORAGE_KEYS.LEGACY_EVENTS, JSON.stringify(session.confirmedEvents));
  } catch {
    // Ignore
  }
}

export function createNewSession(model?: string): ChatSession {
  const newSession: ChatSession = {
    id: generateSessionId(),
    title: 'Cuộc trò chuyện mới',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    confirmedEvents: {},
    model,
  };

  const sessions = loadAllSessions();
  sessions.unshift(newSession);
  saveSessionsList(sessions);
  setActiveSessionId(newSession.id);

  try {
    localStorage.setItem(STORAGE_KEYS.LEGACY_MESSAGES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.LEGACY_EVENTS, JSON.stringify({}));
  } catch {
    // Ignore
  }

  return newSession;
}

export function deleteSessionById(sessionId: string): {
  remainingSessions: ChatSession[];
  newActiveId: string | null;
} {
  const sessions = loadAllSessions().filter((s) => s.id !== sessionId);
  saveSessionsList(sessions);

  let newActiveId = getActiveSessionId();
  if (newActiveId === sessionId) {
    newActiveId = sessions[0]?.id || null;
    if (newActiveId) {
      setActiveSessionId(newActiveId);
      const active = sessions.find((s) => s.id === newActiveId);
      if (active) {
        localStorage.setItem(STORAGE_KEYS.LEGACY_MESSAGES, JSON.stringify(active.messages));
        localStorage.setItem(STORAGE_KEYS.LEGACY_EVENTS, JSON.stringify(active.confirmedEvents));
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_EVENTS);
    }
  }

  return { remainingSessions: sessions, newActiveId };
}
