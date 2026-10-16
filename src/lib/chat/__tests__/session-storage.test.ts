import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createNewSession,
  deleteSessionById,
  deriveSessionTitle,
  getActiveSessionId,
  loadAllSessions,
  saveCurrentSession,
  setActiveSessionId,
} from '../session-storage';

describe('Chat Session Storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('correctly derives session title from first user message', () => {
    const emptyTitle = deriveSessionTitle([]);
    expect(emptyTitle).toBe('Cuộc trò chuyện mới');

    const titled = deriveSessionTitle([
      { id: '1', role: 'user', content: 'Họp nhóm Sprint Review vào sáng mai 9h' },
    ]);
    expect(titled).toBe('Họp nhóm Sprint Review vào sáng mai 9h');

    const longMessage = 'A'.repeat(60);
    const truncated = deriveSessionTitle([{ id: '1', role: 'user', content: longMessage }]);
    expect(truncated.length).toBeLessThanOrEqual(40);
    expect(truncated).toContain('...');
  });

  it('creates and saves new sessions', () => {
    const session1 = createNewSession('test-model');
    expect(session1.id).toBeDefined();
    expect(session1.model).toBe('test-model');
    expect(getActiveSessionId()).toBe(session1.id);

    const all = loadAllSessions();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(session1.id);
  });

  it('updates existing session and updates legacy localStorage keys', () => {
    const session = createNewSession();
    session.messages = [
      { id: 'm1', role: 'user', content: 'Lên lịch demo đối tác' },
    ];
    session.title = 'Lên lịch demo đối tác';

    saveCurrentSession(session);

    const all = loadAllSessions();
    expect(all[0].title).toBe('Lên lịch demo đối tác');
    expect(all[0].messages.length).toBe(1);

    expect(localStorage.getItem('calendai_chat_messages')).toContain('Lên lịch demo đối tác');
  });

  it('deletes session and switches active session appropriately', () => {
    const s1 = createNewSession();
    const s2 = createNewSession();

    expect(getActiveSessionId()).toBe(s2.id);

    const { remainingSessions, newActiveId } = deleteSessionById(s2.id);
    expect(remainingSessions.length).toBe(1);
    expect(newActiveId).toBe(s1.id);
    expect(getActiveSessionId()).toBe(s1.id);
  });
});
