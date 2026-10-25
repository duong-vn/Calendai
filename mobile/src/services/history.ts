import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from 'ai';
import { API_ORIGIN } from './transport';
import { isRecord, parseEvent, parseProposal, type ChatSession } from '../types';

export type HistoryEntry = Pick<ChatSession, 'id' | 'title' | 'updatedAt'>;

export function historyKey(userId: string | null): string {
  return `calendai.history.v1:${encodeURIComponent(API_ORIGIN)}:${encodeURIComponent(userId || 'guest')}`;
}
export function newConversation(): ChatSession {
  return { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`, title: 'Cuộc trò chuyện mới', updatedAt: Date.now(), messages: [], confirmed: {}, submitted: {} };
}

function v2Key(userId: string | null): string {
  return `calendai.history.v2:${encodeURIComponent(API_ORIGIN)}:${encodeURIComponent(userId || 'guest')}`;
}
function sessionKey(userId: string | null, id: string): string {
  return `${v2Key(userId)}:session:${encodeURIComponent(id)}`;
}

const operations = new Map<string, Promise<void>>();

function serialize<T>(userId: string | null, action: () => Promise<T>): Promise<T> {
  const key = v2Key(userId);
  const operation = (operations.get(key) ?? Promise.resolve()).then(action);
  // A failed operation still rejects its caller, but must not block the next one.
  const settled = operation.then(() => undefined, () => undefined);
  operations.set(key, settled);
  void settled.then(() => { if (operations.get(key) === settled) operations.delete(key); });
  return operation;
}

function invalidHistory(): Error {
  return new Error('Lịch sử trên thiết bị không hợp lệ. Chưa ghi đè dữ liệu cũ.');
}

function parseEntry(value: unknown): HistoryEntry {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || typeof value.title !== 'string' ||
      typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) throw invalidHistory();
  return { id: value.id, title: value.title, updatedAt: value.updatedAt };
}

function isMessage(value: unknown): value is Message {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.content !== 'string' ||
      (value.role !== 'assistant' && value.role !== 'user')) return false;
  return value.toolInvocations === undefined || (Array.isArray(value.toolInvocations) && value.toolInvocations.every(tool =>
    isRecord(tool) && typeof tool.toolCallId === 'string' && typeof tool.toolName === 'string' &&
    (tool.state === 'partial-call' || tool.state === 'call' || tool.state === 'result') &&
    'args' in tool && (tool.state !== 'result' || 'result' in tool) &&
    (tool.step === undefined || (typeof tool.step === 'number' && Number.isFinite(tool.step)))));
}

function parseConversation(value: unknown): ChatSession {
  const entry = parseEntry(value);
  if (!isRecord(value) || !Array.isArray(value.messages) || !value.messages.every(isMessage) ||
      (value.confirmed !== undefined && !isRecord(value.confirmed)) ||
      (value.submitted !== undefined && !isRecord(value.submitted))) throw invalidHistory();
  const confirmed = isRecord(value.confirmed) ? Object.fromEntries(Object.entries(value.confirmed).map(([id, event]) => [id, parseEvent(event)])) : {};
  const submitted = isRecord(value.submitted) ? Object.fromEntries(Object.entries(value.submitted).map(([id, proposal]) => [id, parseProposal(proposal)])) : {};
  return { ...entry, messages: value.messages, confirmed, submitted };
}

function uniqueEntries(entries: HistoryEntry[]): HistoryEntry[] {
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw invalidHistory();
  return entries.slice(0, 50);
}

// Called only inside the per-user queue, including first-load migration.
async function readIndex(userId: string | null, migrate = false): Promise<HistoryEntry[]> {
  const key = `${v2Key(userId)}:index`;
  const raw = await AsyncStorage.getItem(key);
  if (raw !== null) {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw invalidHistory();
    return uniqueEntries(data.map(parseEntry));
  }
  const legacy = await AsyncStorage.getItem(historyKey(userId));
  if (legacy === null) return [];
  if (!migrate) throw new Error('Hãy tải lịch sử trước khi thay đổi cuộc trò chuyện cũ.');
  const data: unknown = JSON.parse(legacy);
  if (!Array.isArray(data)) throw invalidHistory();
  // Validate the entire source before writing anything, even entries beyond the cap.
  const sessions = data.map(parseConversation);
  const index = uniqueEntries(sessions.map(parseEntry));
  for (const session of sessions.slice(0, 50)) {
    await AsyncStorage.setItem(sessionKey(userId, session.id), JSON.stringify(session));
  }
  await AsyncStorage.setItem(key, JSON.stringify(index));
  // Keep v1 unchanged as a recovery backup; publish the v2 index last.
  return index;
}

export function loadHistory(userId: string | null): Promise<HistoryEntry[]> {
  return serialize(userId, () => readIndex(userId, true));
}

export function loadConversation(userId: string | null, id: string): Promise<ChatSession> {
  return serialize(userId, async () => {
    const index = await readIndex(userId, true);
    if (!index.some(entry => entry.id === id)) throw new Error('Không tìm thấy cuộc trò chuyện trên thiết bị.');
    const raw = await AsyncStorage.getItem(sessionKey(userId, id));
    if (raw === null) throw new Error('Không tìm thấy nội dung cuộc trò chuyện trên thiết bị.');
    const session = parseConversation(JSON.parse(raw));
    if (session.id !== id) throw invalidHistory();
    return session;
  });
}

export async function saveConversation(userId: string | null, session: ChatSession): Promise<HistoryEntry[]> {
  // Capture this stream snapshot before waiting for earlier operations.
  const entry = parseEntry(session);
  const value = JSON.stringify(session);
  const empty = session.messages.length === 0;
  return serialize(userId, async () => {
    const index = await readIndex(userId);
    if (empty) return index;
    const next = [entry, ...index.filter(item => item.id !== entry.id)]
      .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
    await AsyncStorage.setItem(sessionKey(userId, entry.id), value);
    await AsyncStorage.setItem(`${v2Key(userId)}:index`, JSON.stringify(next));
    return next;
  });
}

export function deleteConversation(userId: string | null, id: string): Promise<HistoryEntry[]> {
  return serialize(userId, async () => {
    const index = await readIndex(userId);
    const next = index.filter(entry => entry.id !== id);
    await AsyncStorage.setItem(`${v2Key(userId)}:index`, JSON.stringify(next));
    // Retain orphaned content deliberately; deletion only changes the visible index.
    return next;
  });
}
