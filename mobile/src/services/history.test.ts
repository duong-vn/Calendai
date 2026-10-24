import AsyncStorage from '@react-native-async-storage/async-storage';
import { historyKey, loadHistory, newConversation, saveHistory } from './history';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

it('isolates guest and Google accounts and persists actual SDK messages', async () => {
  const conversation = { ...newConversation(), messages: [{ id: 'u1', role: 'user' as const, content: 'Xin chào' }] };
  await saveHistory('account-a', [conversation]);
  expect(await loadHistory('account-a')).toHaveLength(1);
  expect(await loadHistory('account-b')).toEqual([]);
  expect(await loadHistory(null)).toEqual([]);
  expect(historyKey('account-a')).not.toBe(historyKey(null));
});
it('serializes writes without letting an earlier stream snapshot overwrite the last', async () => {
  const conversation = { ...newConversation(), messages: [{ id: 'u1', role: 'user' as const, content: 'A' }] };
  await Promise.all([saveHistory('write-test', [conversation]), saveHistory('write-test', [{ ...conversation, title: 'Latest' }])]);
  expect((await loadHistory('write-test'))[0].title).toBe('Latest');
});
it('does not overwrite damaged history silently', async () => {
  await AsyncStorage.setItem(historyKey('damaged'), '{');
  await expect(loadHistory('damaged')).rejects.toThrow();
  expect(await AsyncStorage.getItem(historyKey('damaged'))).toBe('{');
});
