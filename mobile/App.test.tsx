import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert, TouchableOpacity, FlatList } from 'react-native';
import type { ChatSession } from './src/types';
import App from './App';
import { Action, Copy, IconButton } from './src/theme';
import { loadHistory, loadConversation, newConversation, saveConversation, deleteConversation } from './src/services/history';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('./src/services/auth', () => ({ authClient: { subscribe: () => () => undefined, getSnapshot: () => null, restore: async () => undefined }, signInGoogle: jest.fn(), signOutGoogle: jest.fn() }));
jest.mock('./src/services/api', () => ({ fetchModels: async () => ({ models: [], defaultModel: '' }), mobileApi: {} }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@expo-google-fonts/plus-jakarta-sans', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const View = require('react-native').View;
  return { SafeAreaProvider: View, SafeAreaView: View };
});
jest.mock('./src/components/VoiceAssistantBar', () => ({ VoiceAssistantBar: () => null }));
jest.mock('./src/components/ChatMessage', () => ({ ChatMessage: () => null }));
jest.mock('./src/components/AgendaCard', () => ({ AgendaCard: () => null }));
jest.mock('./src/components/Sheet', () => ({ Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('ai/react', () => ({ useChat: ({ initialMessages }: { initialMessages: unknown[] }) => ({ messages: initialMessages, input: '', setInput: mockSetInput, stop: mockStop, isLoading: false }) }));
const mockSetInput = jest.fn();
jest.mock('react-native/Libraries/Lists/FlatList', () => 'FlatList');
jest.mock('./src/services/history', () => ({ ...jest.requireActual('./src/services/history'), loadHistory: jest.fn(), loadConversation: jest.fn(), saveConversation: jest.fn().mockResolvedValue([]), deleteConversation: jest.fn() }));
const mockStop = jest.fn();
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

it('shows a retryable history error without mounting chat or overwriting stored data', async () => {
  jest.mocked(loadHistory).mockRejectedValueOnce(new Error('damaged')).mockResolvedValueOnce([]);
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<App />); });
  await flush();
  expect(tree.root.findAllByType(Copy).some(node => String(node.props.children).includes('Dữ liệu cũ được giữ nguyên'))).toBe(true);
  expect(saveConversation).not.toHaveBeenCalled();
  await act(async () => { tree.root.findAllByType(Action).find(node => node.props.label === 'Thử đọc lại lịch sử')!.props.onPress(); });
  await flush();
  expect(loadHistory).toHaveBeenCalledTimes(2);
  act(() => tree.unmount());
});

it('ignores an older session load while a newer selection is pending', async () => {
  const session = (id: string): ChatSession => ({ ...newConversation(), id, title: id, messages: [{ id, role: 'user', content: id }] });
  const a = session('A'); const b = session('B');
  jest.mocked(loadHistory).mockResolvedValue([a, b]);
  let resolveA!: (value: ChatSession) => void;
  let resolveB!: (value: ChatSession) => void;
  jest.mocked(loadConversation).mockResolvedValueOnce(a)
    .mockImplementationOnce(() => new Promise(resolve => { resolveB = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }));
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<App />); });
  await flush();
  const open = (title: string) => tree.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === `Mở ${title}`)!.props.onPress();
  act(() => open('B'));
  act(() => open('A'));
  await act(async () => resolveB(b));
  expect(tree.root.findAllByType(FlatList)).toHaveLength(0);
  await act(async () => resolveA(a));
  expect(tree.root.findAllByType(FlatList)[0].props.data[0].id).toBe('A');
  act(() => tree.unmount());
});

it('does not resurrect a deleted session when conversation cleanup saves during pending deletion', async () => {
  const session = (id: string) => ({ ...newConversation(), id, title: id, messages: [{ id: `m-${id}`, role: 'user' as const, content: id }] });
  jest.mocked(loadHistory).mockResolvedValue([session('A'), session('B')]);
  jest.mocked(loadConversation).mockResolvedValue(session('A'));
  let finish!: () => void;
  jest.mocked(deleteConversation).mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve([]); })).mockResolvedValue([]);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => { buttons?.find(button => button.text === 'Xóa')?.onPress?.(); });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<App />); });
  await flush();
  act(() => tree.root.findAllByType(IconButton).find(node => node.props.label === 'Xóa B')!.props.onPress());
  act(() => tree.root.findAllByType(Action).find(node => node.props.label === 'Cuộc trò chuyện mới')!.props.onPress());
  await flush();
  expect(deleteConversation).toHaveBeenCalledWith(null, 'B');
  expect(saveConversation).toHaveBeenCalled();
  expect(jest.mocked(saveConversation).mock.calls.every(([, session]) => session.id !== 'B')).toBe(true);
  await act(async () => finish());
  act(() => tree.unmount());
  alert.mockRestore();
});
