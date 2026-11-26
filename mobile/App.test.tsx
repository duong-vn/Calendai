import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert, TouchableOpacity, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReminderSettings } from './src/components/ReminderSettings';
import { saveReminderMinutes } from './src/services/reminders';
import type { ChatSession, MeetingProposal } from './src/types';
import App from './App';
import { Action, Copy, IconButton } from './src/theme';
import { loadHistory, loadConversation, newConversation, saveConversation, deleteConversation } from './src/services/history';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('./src/services/auth', () => ({ authClient: { subscribe: () => () => undefined, getSnapshot: () => null, restore: async () => undefined }, signInGoogle: jest.fn(), signOutGoogle: jest.fn() }));
jest.mock('./src/services/api', () => ({ mobileApi: {} }));
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

it('exposes locally persisted reminder settings through the existing settings sheet', async () => {
  await AsyncStorage.clear();
  await saveReminderMinutes([]);
  jest.mocked(loadHistory).mockResolvedValue([]);
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<App />); });
  await flush();
  expect(tree.root.findAllByType(ReminderSettings)[0].props.minutes).toEqual([]);
  act(() => tree.root.findAllByType(IconButton).find(node => node.props.label === 'Cài đặt & đăng nhập Google')!.props.onPress());
  await act(async () => tree.root.findAllByType(ReminderSettings)[0].props.onSave([30, 5]));
  expect(tree.root.findAllByType(ReminderSettings)[0].props.minutes).toEqual([30, 5]);
  act(() => tree.unmount());
  await AsyncStorage.clear();
});

it('shows a retryable history error without mounting chat or overwriting stored data', async () => {
  jest.mocked(loadHistory).mockRejectedValueOnce(new Error('damaged')).mockResolvedValueOnce([]);
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<App />); });
  await flush();
  expect(tree.root.findAllByType(Copy).some(node => String(node.props.children).includes('Dữ liệu cũ được giữ nguyên'))).toBe(true);
  expect(saveConversation).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(Action).find(node => node.props.label === 'Cuộc trò chuyện mới')!.props.disabled).toBe(true);
  await act(async () => { tree.root.findAllByType(Action).find(node => node.props.label === 'Thử đọc lại lịch sử')!.props.onPress(); });
  await flush();
  expect(loadHistory).toHaveBeenCalledTimes(2);
  act(() => tree.unmount());
});

it('waits for the history index before creating a writable chat and persisting confirmation', async () => {
  let resolveHistory!: (value: Awaited<ReturnType<typeof loadHistory>>) => void;
  jest.mocked(loadHistory).mockImplementationOnce(() => new Promise(resolve => { resolveHistory = resolve; }));
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<App />); });
  await flush();
  const newChat = () => tree.root.findAllByType(Action).find(node => node.props.label === 'Cuộc trò chuyện mới')!;
  expect(newChat().props.disabled).toBe(true);
  expect(tree.root.findAllByType(FlatList)).toHaveLength(0);
  expect(saveConversation).not.toHaveBeenCalled();

  const previous: ChatSession = { ...newConversation(), id: 'previous', messages: [{ id: 'm', role: 'user', content: 'Lịch cũ' }] };
  jest.mocked(loadConversation).mockResolvedValueOnce(previous);
  await act(async () => resolveHistory([previous]));
  expect(newChat().props.disabled).toBe(false);
  act(() => newChat().props.onPress());
  const list = tree.root.findAllByType(FlatList)[0];
  expect(list.props.data).toEqual([]);
  const proposal: MeetingProposal = { proposalId: 'new-proposal', summary: 'Họp nhóm', startDateTime: '2026-11-19T09:00:00+07:00', endDateTime: '2026-11-19T10:00:00+07:00', timeZone: 'Asia/Ho_Chi_Minh', attendees: [], createMeet: true };
  const message = { id: 'new-message', role: 'user', content: 'Họp nhóm sáng mai' };
  // The chat hook owns streamed messages; feed its list through the existing render callback.
  list.props.data.push(message);
  const rendered = list.props.renderItem({ item: message });
  await act(async () => { await rendered.props.onSubmit(proposal); });
  expect(saveConversation).toHaveBeenLastCalledWith(null, expect.objectContaining({
    id: expect.not.stringMatching(/^previous$/), messages: [message], submitted: { 'new-proposal': proposal },
  }));
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

it('does not update submitted state or unmount snapshots when local persistence fails in onSubmit', async () => {
  const existing: ChatSession = { ...newConversation(), id: 'chat-fail', messages: [{ id: 'm1', role: 'user', content: 'Họp' }] };
  jest.mocked(loadHistory).mockResolvedValue([existing]);
  jest.mocked(loadConversation).mockResolvedValue(existing);
  jest.mocked(saveConversation).mockReset().mockRejectedValueOnce(new Error('Storage full')).mockResolvedValue([]);
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => { tree = create(<App />); });
    await flush();

    const proposal: MeetingProposal = { proposalId: 'p-fail', summary: 'Họp', startDateTime: '2026-11-19T09:00:00+07:00', endDateTime: '2026-11-19T10:00:00+07:00', timeZone: 'Asia/Ho_Chi_Minh', attendees: [], createMeet: true };
    const list = tree!.root.findAllByType(FlatList)[0];
    const rendered = list.props.renderItem({ item: existing.messages[0] });

    await expect(act(async () => { await rendered.props.onSubmit(proposal); })).rejects.toThrow();

    const refreshed = tree!.root.findAllByType(FlatList)[0].props.renderItem({ item: existing.messages[0] });
    expect(refreshed.props.submitted).toEqual({});

    act(() => tree?.unmount());
    tree = undefined;
    await flush();
    expect(saveConversation).toHaveBeenLastCalledWith(null, expect.objectContaining({ submitted: {} }));
  } finally {
    if (tree) act(() => tree?.unmount());
  }
});

it('unlocks first-attempt submitted drafts in state and storage on discard, but preserves previously persisted drafts', async () => {
  const proposalA: MeetingProposal = { proposalId: 'p-a', summary: 'Họp A', startDateTime: '2026-11-19T09:00:00+07:00', endDateTime: '2026-11-19T10:00:00+07:00', timeZone: 'Asia/Ho_Chi_Minh', attendees: [], createMeet: true };
  const proposalB: MeetingProposal = { proposalId: 'p-b', summary: 'Họp B', startDateTime: '2026-11-19T11:00:00+07:00', endDateTime: '2026-11-19T12:00:00+07:00', timeZone: 'Asia/Ho_Chi_Minh', attendees: [], createMeet: false };
  const existing: ChatSession = {
    ...newConversation(),
    id: 'chat-unlock',
    messages: [{ id: 'm1', role: 'user', content: 'Họp' }],
    submitted: { [proposalB.proposalId]: proposalB },
  };
  jest.mocked(loadHistory).mockResolvedValue([existing]);
  jest.mocked(loadConversation).mockResolvedValue(existing);
  jest.mocked(saveConversation).mockReset().mockResolvedValue([]);
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => { tree = create(<App />); });
    await flush();

    const rendered = () => tree!.root.findAllByType(FlatList)[0].props.renderItem({ item: existing.messages[0] });

    let discardA!: (() => Promise<boolean>) | undefined;
    await act(async () => { discardA = await rendered().props.onSubmit(proposalA); });
    expect(rendered().props.submitted).toEqual({ [proposalB.proposalId]: proposalB, [proposalA.proposalId]: proposalA });
    expect(saveConversation).toHaveBeenLastCalledWith(null, expect.objectContaining({
      submitted: { [proposalB.proposalId]: proposalB, [proposalA.proposalId]: proposalA },
    }));

    let unlocked = false;
    await act(async () => { unlocked = (await discardA?.()) ?? false; });
    expect(unlocked).toBe(true);
    expect(rendered().props.submitted).toEqual({ [proposalB.proposalId]: proposalB });
    expect(saveConversation).toHaveBeenLastCalledWith(null, expect.objectContaining({
      submitted: { [proposalB.proposalId]: proposalB },
    }));

    let discardB!: (() => Promise<boolean>) | undefined;
    await act(async () => { discardB = await rendered().props.onSubmit(proposalB); });
    let unlockedB = true;
    await act(async () => { unlockedB = (await discardB?.()) ?? true; });
    expect(unlockedB).toBe(false);
    expect(rendered().props.submitted).toEqual({ [proposalB.proposalId]: proposalB });
  } finally {
    if (tree) act(() => tree?.unmount());
  }
});

it('keeps the conversation row, delete retry button, and original content when deletion fails, then deletes cleanly on retry', async () => {
  const actualHistory = jest.requireActual<typeof import('./src/services/history')>('./src/services/history');
  await AsyncStorage.clear();
  const makeSession = (id: string, content: string): ChatSession => ({
    ...newConversation(),
    id,
    title: content,
    updatedAt: id === 'A' ? 2000 : 1000,
    messages: [{ id: `m-${id}`, role: 'user', content }],
  });
  const sessionA = makeSession('A', 'Nội dung gốc A');
  const sessionB = makeSession('B', 'Nội dung gốc B');
  await actualHistory.saveConversation(null, sessionA);
  await actualHistory.saveConversation(null, sessionB);

  jest.mocked(loadHistory).mockImplementation(actualHistory.loadHistory);
  jest.mocked(loadConversation).mockImplementation(actualHistory.loadConversation);
  jest.mocked(saveConversation).mockImplementation(actualHistory.saveConversation);
  jest.mocked(deleteConversation).mockImplementation(actualHistory.deleteConversation);

  const write = jest.mocked(AsyncStorage.setItem).getMockImplementation();
  if (!write) throw new Error('Missing AsyncStorage.setItem mock');
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value, callback) => {
    if (key.endsWith(':index')) throw new Error('Disk full');
    return write.call(AsyncStorage, key, value, callback);
  });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find(button => button.text === 'Xóa')?.onPress?.();
  });

  const drain = async () => {
    for (let i = 0; i < 8; i++) await flush();
  };

  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => { tree = create(<App />); });
    await drain();

    // Open B, confirm content, then return to A before deleting B
    act(() => tree!.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === 'Mở Nội dung gốc B')!.props.onPress());
    await drain();
    expect(tree!.root.findAllByType(FlatList)[0].props.data[0].content).toBe('Nội dung gốc B');
    act(() => tree!.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === 'Mở Nội dung gốc A')!.props.onPress());
    await drain();

    // Attempt 1: index write fails -> error shown, row B and "Xóa Nội dung gốc B" stay accessible
    await act(async () => {
      tree!.root.findAllByType(IconButton).find(node => node.props.label === 'Xóa Nội dung gốc B')!.props.onPress();
    });
    await drain();

    expect(tree!.root.findAllByType(Copy).some(node => String(node.props.children).includes('Không xóa được lịch sử. Vui lòng thử lại.'))).toBe(true);
    expect(tree!.root.findAllByType(TouchableOpacity).some(node => node.props.accessibilityLabel === 'Mở Nội dung gốc B')).toBe(true);
    const retryDeleteButton = tree!.root.findAllByType(IconButton).find(node => node.props.label === 'Xóa Nội dung gốc B');
    expect(retryDeleteButton).toBeDefined();
    expect(retryDeleteButton!.props.disabled).toBeFalsy();

    // Original content of B remains intact when opened
    act(() => tree!.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === 'Mở Nội dung gốc B')!.props.onPress());
    await drain();
    expect(tree!.root.findAllByType(FlatList)[0].props.data[0].content).toBe('Nội dung gốc B');

    // Remounting while deletion failed still restores B with its original content
    act(() => tree!.unmount());
    tree = undefined;
    await drain();
    await act(async () => { tree = create(<App />); });
    await drain();
    expect(tree!.root.findAllByType(TouchableOpacity).some(node => node.props.accessibilityLabel === 'Mở Nội dung gốc B')).toBe(true);

    // Attempt 2: storage recovers -> retry deleting B succeeds and stays deleted on remount
    jest.mocked(AsyncStorage.setItem).mockImplementation(write);
    await act(async () => {
      tree!.root.findAllByType(IconButton).find(node => node.props.label === 'Xóa Nội dung gốc B')!.props.onPress();
    });
    await drain();

    expect(tree!.root.findAllByType(TouchableOpacity).some(node => node.props.accessibilityLabel === 'Mở Nội dung gốc B')).toBe(false);
    expect(tree!.root.findAllByType(IconButton).some(node => node.props.label === 'Xóa Nội dung gốc B')).toBe(false);

    act(() => tree!.unmount());
    tree = undefined;
    await drain();
    await act(async () => { tree = create(<App />); });
    await drain();
    expect(tree!.root.findAllByType(TouchableOpacity).some(node => node.props.accessibilityLabel === 'Mở Nội dung gốc A')).toBe(true);
    expect(tree!.root.findAllByType(TouchableOpacity).some(node => node.props.accessibilityLabel === 'Mở Nội dung gốc B')).toBe(false);
  } finally {
    jest.mocked(AsyncStorage.setItem).mockImplementation(write);
    alert.mockRestore();
    if (tree) act(() => tree?.unmount());
    jest.mocked(loadHistory).mockReset();
    jest.mocked(loadConversation).mockReset();
    jest.mocked(saveConversation).mockReset().mockResolvedValue([]);
    jest.mocked(deleteConversation).mockReset();
    await AsyncStorage.clear();
  }
});

it('keeps the active conversation open when its deletion fails and prevents unmount autosave from resurrecting it during pending deletion', async () => {
  const session = (id: string): ChatSession => ({
    ...newConversation(),
    id,
    title: id,
    messages: [{ id: `m-${id}`, role: 'user', content: `Nội dung ${id}` }],
  });
  const sessionA = session('A');
  const sessionB = session('B');
  jest.mocked(loadHistory).mockResolvedValue([sessionA, sessionB]);
  jest.mocked(loadConversation).mockResolvedValue(sessionA);
  jest.mocked(saveConversation).mockReset().mockResolvedValue([]);

  let resolveDelete!: (value: typeof sessionA[]) => void;
  jest.mocked(deleteConversation)
    .mockRejectedValueOnce(new Error('Write failed'))
    .mockImplementationOnce(() => new Promise(resolve => { resolveDelete = resolve; }));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find(button => button.text === 'Xóa')?.onPress?.();
  });

  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => { tree = create(<App />); });
    await flush();

    // Deleting active conversation A fails -> A stays open with original message and retryable Xóa A button
    await act(async () => {
      tree!.root.findAllByType(IconButton).find(node => node.props.label === 'Xóa A')!.props.onPress();
    });
    await flush();
    expect(tree!.root.findAllByType(Copy).some(node => String(node.props.children).includes('Không xóa được lịch sử. Vui lòng thử lại.'))).toBe(true);
    expect(tree!.root.findAllByType(FlatList)[0].props.data[0].content).toBe('Nội dung A');
    expect(tree!.root.findAllByType(IconButton).find(node => node.props.label === 'Xóa A')!.props.disabled).toBeFalsy();

    // Retry deleting A -> while pending, button is disabled and unmounting A via "Cuộc trò chuyện mới" does not save/resurrect A
    act(() => tree!.root.findAllByType(IconButton).find(node => node.props.label === 'Xóa A')!.props.onPress());
    expect(tree!.root.findAllByType(IconButton).find(node => node.props.label === 'Xóa A')!.props.disabled).toBe(true);

    act(() => tree!.root.findAllByType(Action).find(node => node.props.label === 'Cuộc trò chuyện mới')!.props.onPress());
    await flush();
    expect(jest.mocked(saveConversation).mock.calls.every(([, saved]) => saved.id !== 'A')).toBe(true);

    await act(async () => { resolveDelete([]); });
    await flush();
    expect(tree!.root.findAllByType(IconButton).some(node => node.props.label === 'Xóa A')).toBe(false);
    expect(tree!.root.findAllByType(Copy).some(node => String(node.props.children).includes('Không xóa được lịch sử. Vui lòng thử lại.'))).toBe(false);
  } finally {
    alert.mockRestore();
    if (tree) act(() => tree?.unmount());
  }
});
