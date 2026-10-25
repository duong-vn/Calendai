import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatSession } from '../types';
import { deleteConversation, historyKey, loadConversation, loadHistory, newConversation, saveConversation, type HistoryEntry } from './history';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const indexKey = (userId: string | null) => `${historyKey(userId).replace('history.v1:', 'history.v2:')}:index`;
const sessionKey = (userId: string | null, id: string) => `${historyKey(userId).replace('history.v1:', 'history.v2:')}:session:${encodeURIComponent(id)}`;
const entry = ({ id, title, updatedAt }: ChatSession): HistoryEntry => ({ id, title, updatedAt });
function conversation(id = 'chat-1'): ChatSession {
  return {
    ...newConversation(), id, title: id, updatedAt: 1000,
    messages: [
      { id: 'u1', role: 'user', content: 'Xin chào' },
      { id: 'a1', role: 'assistant', content: '', toolInvocations: [{ state: 'call', toolCallId: 'tool-1', toolName: 'proposeMeeting', args: {} }] },
    ],
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

it('isolates guest and Google accounts and persists actual SDK messages', async () => {
  const session = conversation('id:/ có dấu');
  expect(await saveConversation('account-a', session)).toEqual([entry(session)]);
  expect(await loadHistory('account-a')).toEqual([entry(session)]);
  expect(await loadConversation('account-a', session.id)).toEqual(session);
  expect(await loadHistory('account-b')).toEqual([]);
  expect(await loadHistory(null)).toEqual([]);
  await expect(loadConversation('account-b', session.id)).rejects.toThrow();
  await expect(loadConversation(null, session.id)).rejects.toThrow();
  expect(historyKey('account-a')).not.toBe(historyKey(null));
  expect(await AsyncStorage.getItem(sessionKey('account-a', session.id))).not.toBeNull();
});

it('keeps the index sorted by latest update rather than write order', async () => {
  const recent = { ...conversation('recent'), updatedAt: 3000 };
  const older = { ...conversation('older'), updatedAt: 1000 };
  const middle = { ...conversation('middle'), updatedAt: 2000 };
  await saveConversation('sorted', recent);
  await saveConversation('sorted', older);
  expect(await saveConversation('sorted', middle)).toEqual([entry(recent), entry(middle), entry(older)]);
  expect(await loadHistory('sorted')).toEqual([entry(recent), entry(middle), entry(older)]);
});

it('does not persist a newly opened empty chat or rewrite existing history', async () => {
  const saved = conversation('saved');
  await saveConversation('empty', saved);
  jest.clearAllMocks();
  expect(await saveConversation('empty', newConversation())).toEqual([entry(saved)]);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(await loadHistory('empty')).toEqual([entry(saved)]);
});

it('migrates legacy sessions once, writes the index last and preserves v1 unchanged', async () => {
  const sessions = [conversation('A'), conversation('B')];
  const source = JSON.stringify(sessions);
  await AsyncStorage.setItem(historyKey('legacy'), source);
  jest.clearAllMocks();

  expect(await loadHistory('legacy')).toEqual(sessions.map(entry));
  expect(jest.mocked(AsyncStorage.setItem).mock.calls.map(([key]) => key)).toEqual([
    sessionKey('legacy', 'A'), sessionKey('legacy', 'B'), indexKey('legacy'),
  ]);
  expect(await AsyncStorage.getItem(historyKey('legacy'))).toBe(source);
  expect(await loadConversation('legacy', 'B')).toEqual(sessions[1]);

  jest.clearAllMocks();
  expect(await loadHistory('legacy')).toEqual(sessions.map(entry));
  expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
  expect(AsyncStorage.getItem).toHaveBeenCalledWith(indexKey('legacy'));
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it.each([
  '{',
  '{}',
  JSON.stringify([conversation('valid'), { id: 'broken' }]),
  JSON.stringify([conversation('valid'), { ...conversation('bad-message'), messages: [{ id: 'u', role: 'user', content: 1 }] }]),
  JSON.stringify([conversation('valid'), { ...conversation('bad-tool'), messages: [{ id: 'a', role: 'assistant', content: '', toolInvocations: {} }] }]),
  JSON.stringify([conversation('valid'), { ...conversation('bad-tool'), messages: [{ id: 'a', role: 'assistant', content: '', toolInvocations: [null] }] }]),
  JSON.stringify([conversation('valid'), { ...conversation('bad-event'), confirmed: { event: {} } }]),
  JSON.stringify([conversation('valid'), { ...conversation('bad-proposal'), submitted: { proposal: {} } }]),
  JSON.stringify([...Array.from({ length: 50 }, (_, i) => conversation(String(i))), { id: 'invalid-beyond-cap' }]),
])('rejects malformed legacy data without writing any v2 data or changing the source (%#)', async source => {
  await AsyncStorage.setItem(historyKey('damaged'), source);
  jest.clearAllMocks();
  await expect(loadHistory('damaged')).rejects.toThrow();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(historyKey('damaged'))).toBe(source);
  expect(await AsyncStorage.getItem(indexKey('damaged'))).toBeNull();
});

it('does not migrate on save or delete before legacy history is loaded', async () => {
  const source = JSON.stringify([conversation('old')]);
  await AsyncStorage.setItem(historyKey('legacy'), source);
  jest.clearAllMocks();
  await expect(saveConversation('legacy', conversation('new'))).rejects.toThrow();
  await expect(deleteConversation('legacy', 'old')).rejects.toThrow();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(historyKey('legacy'))).toBe(source);
});

it('uses an existing v2 index even when the legacy backup is malformed', async () => {
  await AsyncStorage.setItem(historyKey('existing'), '{');
  await AsyncStorage.setItem(indexKey('existing'), '[]');
  jest.clearAllMocks();
  expect(await loadHistory('existing')).toEqual([]);
  expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('serializes initialization with concurrent reads and saves', async () => {
  const old = conversation('old');
  const added = conversation('added');
  await AsyncStorage.setItem(historyKey('initializing'), JSON.stringify([old]));
  jest.clearAllMocks();
  const [first, saved, last] = await Promise.all([
    loadHistory('initializing'), saveConversation('initializing', added), loadHistory('initializing'),
  ]);
  expect(first).toEqual([entry(old)]);
  expect(saved).toEqual([entry(added), entry(old)]);
  expect(last).toEqual(saved);
  expect(jest.mocked(AsyncStorage.setItem).mock.calls.filter(([key]) => key === sessionKey('initializing', old.id))).toHaveLength(1);
});

it('serializes stream snapshots without letting an earlier write overwrite the last', async () => {
  const session = conversation();
  const first = saveConversation('writes', session);
  session.title = 'Latest';
  session.messages[0].content = 'Latest content';
  const second = saveConversation('writes', session);
  const [earlier, latest] = await Promise.all([first, second]);
  expect(earlier[0].title).toBe('chat-1');
  expect(latest[0].title).toBe('Latest');
  expect((await loadConversation('writes', session.id)).messages[0].content).toBe('Latest content');
  expect(jest.mocked(AsyncStorage.setItem).mock.calls.map(([key]) => key)).toEqual([
    sessionKey('writes', session.id), indexKey('writes'), sessionKey('writes', session.id), indexKey('writes'),
  ]);
});

it.each([true, false])('does not resurrect a deleted chat or lose a concurrent save of another chat (delete first: %s)', async deleteFirst => {
  const a = conversation('A');
  const b = conversation('B');
  await saveConversation('race', a);
  await saveConversation('race', b);
  const updated = { ...b, title: 'Updated B' };
  await Promise.all(deleteFirst
    ? [deleteConversation('race', a.id), saveConversation('race', updated)]
    : [saveConversation('race', updated), deleteConversation('race', a.id)]);
  expect(await loadHistory('race')).toEqual([entry(updated)]);
  await expect(loadConversation('race', a.id)).rejects.toThrow();
  expect(await loadConversation('race', b.id)).toEqual(updated);
  expect(await AsyncStorage.getItem(sessionKey('race', a.id))).not.toBeNull();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
});

it('reads only the small index when listing and only the selected blob when opening', async () => {
  const a = conversation('A');
  const b = conversation('B');
  await saveConversation('lazy', a);
  await saveConversation('lazy', b);
  jest.clearAllMocks();
  expect(await loadHistory('lazy')).toEqual([entry(b), entry(a)]);
  expect(jest.mocked(AsyncStorage.getItem).mock.calls).toEqual([[indexKey('lazy')]]);
  jest.clearAllMocks();
  expect(await loadConversation('lazy', a.id)).toEqual(a);
  expect(jest.mocked(AsyncStorage.getItem).mock.calls).toEqual([[indexKey('lazy')], [sessionKey('lazy', a.id)]]);
});

it('saves only the changed session and the small index, not unrelated content', async () => {
  const a = conversation('A');
  const b = conversation('B');
  await saveConversation('targeted', a);
  await saveConversation('targeted', b);
  jest.clearAllMocks();
  const updated = { ...a, title: 'Updated A' };
  expect(await saveConversation('targeted', updated)).toEqual([entry(updated), entry(b)]);
  expect(jest.mocked(AsyncStorage.getItem).mock.calls).toEqual([[indexKey('targeted')]]);
  expect(jest.mocked(AsyncStorage.setItem).mock.calls).toEqual([
    [sessionKey('targeted', a.id), JSON.stringify(updated)],
    [indexKey('targeted'), JSON.stringify([entry(updated), entry(b)])],
  ]);
});

it('caps migration and subsequent saves at 50 index entries without deleting blobs', async () => {
  const sessions = Array.from({ length: 51 }, (_, i) => conversation(String(i)));
  await AsyncStorage.setItem(historyKey('capped'), JSON.stringify(sessions));
  expect(await loadHistory('capped')).toEqual(sessions.slice(0, 50).map(entry));
  const added = conversation('new');
  expect(await saveConversation('capped', added)).toEqual([entry(added), ...sessions.slice(0, 49).map(entry)]);
  expect(await AsyncStorage.getItem(sessionKey('capped', '49'))).not.toBeNull();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
});

it('rejects invalid loaded tool invocations instead of passing them to the UI', async () => {
  const session = conversation();
  await saveConversation('bad-blob', session);
  await AsyncStorage.setItem(sessionKey('bad-blob', session.id), JSON.stringify({
    ...session, messages: [{ id: 'a', role: 'assistant', content: '', toolInvocations: [{ state: 'result', toolCallId: 't', toolName: 'proposeMeeting', args: {} }] }],
  }));
  await expect(loadConversation('bad-blob', session.id)).rejects.toThrow();
});

it('rejects malformed v2 indexes without falling back to legacy or overwriting data', async () => {
  await AsyncStorage.setItem(historyKey('bad-index'), JSON.stringify([conversation()]));
  await AsyncStorage.setItem(indexKey('bad-index'), '{');
  jest.clearAllMocks();
  await expect(loadHistory('bad-index')).rejects.toThrow();
  await expect(saveConversation('bad-index', conversation('new'))).rejects.toThrow();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('rejects a failed session write without publishing the index and allows queued writes to recover', async () => {
  const a = conversation('A');
  const b = conversation('B');
  await saveConversation('failure', a);
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Storage full'));
  const failed = saveConversation('failure', conversation('failed'));
  const recovered = saveConversation('failure', b);
  await expect(failed).rejects.toThrow('Storage full');
  expect(await recovered).toEqual([entry(b), entry(a)]);
  expect(await loadHistory('failure')).toEqual([entry(b), entry(a)]);
});

it('rejects a failed index write without losing the previous index or blocking later saves', async () => {
  const a = conversation('A');
  const b = conversation('B');
  const c = conversation('C');
  await saveConversation('index-failure', a);
  const write = jest.mocked(AsyncStorage.setItem).getMockImplementation();
  if (!write) throw new Error('Missing storage mock');
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(write).mockRejectedValueOnce(new Error('Index write failed'));
  await expect(saveConversation('index-failure', b)).rejects.toThrow('Index write failed');
  expect(await loadHistory('index-failure')).toEqual([entry(a)]);
  expect(await saveConversation('index-failure', c)).toEqual([entry(c), entry(a)]);
  expect(await AsyncStorage.getItem(sessionKey('index-failure', b.id))).not.toBeNull();
});

it('rejects a failed migration write, leaves the index unpublished and retries safely', async () => {
  const sessions = [conversation('A'), conversation('B')];
  const source = JSON.stringify(sessions);
  await AsyncStorage.setItem(historyKey('migration-failure'), source);
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Storage full'));
  await expect(loadHistory('migration-failure')).rejects.toThrow('Storage full');
  expect(await AsyncStorage.getItem(indexKey('migration-failure'))).toBeNull();
  expect(await AsyncStorage.getItem(historyKey('migration-failure'))).toBe(source);
  expect(await loadHistory('migration-failure')).toEqual(sessions.map(entry));
});
