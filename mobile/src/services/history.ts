import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from 'ai';
import { API_ORIGIN } from './transport';
import { isRecord, parseEvent, parseProposal, type ChatSession } from '../types';

export function historyKey(userId: string | null): string {
  return `calendai.history.v1:${encodeURIComponent(API_ORIGIN)}:${encodeURIComponent(userId || 'guest')}`;
}
export function newConversation(): ChatSession {
  return { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`, title: 'Cuộc trò chuyện mới', updatedAt: Date.now(), messages: [], confirmed: {}, submitted: {} };
}
const writes = new Map<string, Promise<void>>();

export async function loadHistory(userId: string | null): Promise<ChatSession[]> {
  const raw = await AsyncStorage.getItem(historyKey(userId));
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Lịch sử trên thiết bị không hợp lệ. Chưa ghi đè dữ liệu cũ.');
  return data.slice(0, 50).map((item): ChatSession => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.updatedAt !== 'number' || !Array.isArray(item.messages)) throw new Error('Lịch sử trên thiết bị không hợp lệ.');
    const messages = item.messages.filter((message): message is Message => isRecord(message) && typeof message.id === 'string' && typeof message.content === 'string' && (message.role === 'assistant' || message.role === 'user'));
    const confirmed = isRecord(item.confirmed) ? Object.fromEntries(Object.entries(item.confirmed).map(([id, value]) => [id, parseEvent(value)])) : {};
    const submitted = isRecord(item.submitted) ? Object.fromEntries(Object.entries(item.submitted).map(([id, value]) => [id, parseProposal(value)])) : {};
    return { id: item.id, title: item.title, updatedAt: item.updatedAt, messages, confirmed, submitted };
  });
}

export function saveHistory(userId: string | null, sessions: ChatSession[]): Promise<void> {
  const key = historyKey(userId);
  const value = JSON.stringify(sessions.filter(s => s.messages.length > 0).slice(0, 50));
  const operation = (writes.get(key) || Promise.resolve()).catch(() => undefined).then(() => AsyncStorage.setItem(key, value));
  writes.set(key, operation);
  void operation.finally(() => { if (writes.get(key) === operation) writes.delete(key); }).catch(() => undefined);
  return operation;
}
