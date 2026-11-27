import React from 'react';
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream } from 'stream/web';
import structuredClonePolyfill from '@ungap/structured-clone';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Switch, Text, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch as expoFetch } from 'expo/fetch';
import { formatDataStreamPart } from '@ai-sdk/ui-utils';

if (typeof globalThis.TextEncoder === 'undefined') {
  Object.assign(globalThis, { TextEncoder });
}
if (typeof globalThis.TextDecoder === 'undefined') {
  Object.assign(globalThis, { TextDecoder });
}
if (typeof globalThis.ReadableStream === 'undefined') {
  Object.assign(globalThis, { ReadableStream });
}
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = <T,>(value: T): T => structuredClonePolyfill(value);
}

const mockSecureStoreData = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreData.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreData.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreData.delete(key);
  }),
}));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    signOut: jest.fn(async () => undefined),
  },
  isErrorWithCode: () => false,
  statusCodes: {},
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('@expo-google-fonts/plus-jakarta-sans', () => ({
  useFonts: () => [true, null],
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaProvider: View, SafeAreaView: View };
});
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    abort: jest.fn(),
    start: jest.fn(),
    isRecognitionAvailable: jest.fn(() => true),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@ronradtke/react-native-markdown-display', () => {
  const ReactMock = require('react');
  const { Text: RNText } = require('react-native');
  return ({ children }: { children: React.ReactNode }) =>
    ReactMock.createElement(RNText, null, children);
});
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const MockFlatList = ReactMock.forwardRef(
    (
      props: {
        data?: unknown[];
        renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
        ListEmptyComponent?: React.ReactNode;
        ListFooterComponent?: React.ReactNode;
      },
      _ref: unknown
    ) =>
      ReactMock.createElement(
        View,
        null,
        props.data && props.data.length > 0
          ? props.data.map((item, index) =>
              ReactMock.createElement(
                ReactMock.Fragment,
                { key: (item as { id?: string })?.id ?? String(index) },
                props.renderItem ? props.renderItem({ item, index }) : null
              )
            )
          : props.ListEmptyComponent ?? null,
        props.ListFooterComponent ?? null
      )
  );
  MockFlatList.displayName = 'FlatList';
  return MockFlatList;
});

import App from '../App';
import { Action, IconButton } from './theme';
import { authClient } from './services/auth';
import { API_ORIGIN } from './services/transport';
import { ProposalCard } from './components/ProposalModal';
import { Sheet } from './components/Sheet';

jest.setTimeout(30_000);

type MockExpoResponse = Awaited<ReturnType<typeof expoFetch>>;

function jsonResponse(value: unknown, status = 200): MockExpoResponse {
  const bodyText = JSON.stringify(value);
  return {
    ok: status >= 200 && status < 300,
    status,
    redirected: false,
    url: `${API_ORIGIN}/api/mock`,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => value,
    text: async () => bodyText,
    body: null,
  } as unknown as MockExpoResponse;
}

function dataStreamResponse(parts: string[], url = `${API_ORIGIN}/api/chat`): MockExpoResponse {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(encoder.encode(part));
      }
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    redirected: false,
    url,
    headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
    text: async () => parts.join(''),
    body,
  } as unknown as MockExpoResponse;
}

function getHeader(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return match ? match[1] : null;
  }
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry ? String(entry[1]) : null;
}

async function flush(turns = 10) {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function waitFor(assertion: () => void, timeoutMs = 1_000, intervalMs = 15) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error;
      }
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      });
    }
  }
}

function collectText(tree: ReactTestRenderer): string {
  return tree.root
    .findAllByType(Text)
    .map((node) =>
      Array.isArray(node.props.children)
        ? node.props.children.join('')
        : String(node.props.children ?? '')
    )
    .join('\n');
}

beforeEach(async () => {
  jest.mocked(expoFetch).mockReset();
  mockSecureStoreData.clear();
  await AsyncStorage.clear();
  await authClient.clear();
  jest.mocked(expoFetch).mockReset();
});

describe('Mobile chat transport across guest and authenticated sessions', () => {
  it('allows guest chat streaming, proposeMeeting preview, and retry via nativeFetch without Authorization while keeping calendar actions gated', async () => {
    const proposal = {
      proposalId: 'guest-proposal-1',
      summary: 'Cà phê chiều thứ Sáu',
      startDateTime: '2026-11-27T15:00:00+07:00',
      endDateTime: '2026-11-27T16:00:00+07:00',
      timeZone: 'Asia/Ho_Chi_Minh',
      attendees: [],
      createMeet: true,
    };

    let chatCallCount = 0;
    jest.mocked(expoFetch).mockImplementation(async (url) => {
      if (url === `${API_ORIGIN}/api/models`) {
        return jsonResponse({ models: [], defaultModel: '' });
      }
      if (url === `${API_ORIGIN}/api/chat`) {
        chatCallCount += 1;
        if (chatCallCount === 1) {
          return dataStreamResponse([
            formatDataStreamPart('text', 'Mình đã chuẩn bị bản thảo hẹn cà phê cho bạn.'),
            formatDataStreamPart('tool_call', {
              toolCallId: 'call-guest-1',
              toolName: 'proposeMeeting',
              args: proposal,
            }),
            formatDataStreamPart('tool_result', {
              toolCallId: 'call-guest-1',
              result: proposal,
            }),
            formatDataStreamPart('finish_message', { finishReason: 'stop' }),
          ]);
        }
        if (chatCallCount === 2) {
          throw new Error('Mạng chập chờn tạm thời');
        }
        return dataStreamResponse([
          formatDataStreamPart('text', 'Đã khôi phục phản hồi cho khách.'),
          formatDataStreamPart('finish_message', { finishReason: 'stop' }),
        ]);
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    let tree: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        tree = create(<App />);
      });
      await flush();

      const input = () =>
        tree!.root
          .findAllByType(TextInput)
          .find((node) => node.props.accessibilityLabel === 'Tin nhắn cho Calendai')!;
      const sendButton = () =>
        tree!.root
          .findAllByType(IconButton)
          .find((node) => node.props.label === 'Gửi tin nhắn')!;

      act(() => {
        input().props.onChangeText('Hẹn cà phê chiều thứ Sáu lúc 15h');
      });
      await act(async () => {
        sendButton().props.onPress();
      });
      await flush();

      const chatCalls = jest
        .mocked(expoFetch)
        .mock.calls.filter(([url]) => url === `${API_ORIGIN}/api/chat`);
      expect(chatCalls).toHaveLength(1);
      const [, firstChatInit] = chatCalls[0];
      expect(firstChatInit?.method).toBe('POST');
      expect(firstChatInit?.credentials).toBe('omit');
      expect(getHeader(firstChatInit?.headers, 'authorization')).toBeNull();
      expect(getHeader(firstChatInit?.headers, 'content-type')).toBe('application/json');
      expect(JSON.parse(String(firstChatInit?.body ?? '{}'))).not.toHaveProperty('model');

      await waitFor(() => {
        const renderedText = collectText(tree!);
        expect(renderedText).toContain('Mình đã chuẩn bị bản thảo hẹn cà phê cho bạn.');
        expect(renderedText).not.toContain('Vui lòng đăng nhập Google để tiếp tục.');
        expect(tree!.root.findAllByType(ProposalCard)).toHaveLength(1);
        expect(renderedText).toContain('Cà phê chiều thứ Sáu');
      });

      // Guest tapping "Xác nhận tạo lịch" still requires Google login via authClient.fetch and unlocks draft
      await act(async () => {
        tree!.root
          .findAllByType(Action)
          .find((node) => node.props.label === 'Xác nhận tạo lịch')!
          .props.onPress();
      });
      await flush();

      expect(
        jest.mocked(expoFetch).mock.calls.some(([url]) => url === `${API_ORIGIN}/api/calendar/confirm`)
      ).toBe(false);
      expect(collectText(tree!)).toContain('Vui lòng đăng nhập Google để tiếp tục.');
      expect(tree!.root.findAllByType(Switch)[0].props.disabled).toBe(false);
      expect(
        tree!.root.findAllByType(Action).some((node) => node.props.label === 'Xác nhận tạo lịch')
      ).toBe(true);

      // Guest opening "Lịch sắp tới" never calls /api/calendar/upcoming and prompts login
      act(() => {
        tree!.root
          .findAllByType(IconButton)
          .find((node) => node.props.label === 'Lịch sắp tới')!
          .props.onPress();
      });
      await flush(4);
      expect(
        jest.mocked(expoFetch).mock.calls.some(([url]) => url === `${API_ORIGIN}/api/calendar/upcoming`)
      ).toBe(false);
      expect(collectText(tree!)).toContain('Đăng nhập Google để xem lịch thật của bạn.');
      act(() => {
        const visibleSheet = tree!.root
          .findAllByType(Sheet)
          .find((node) => node.props.visible === true)!;
        visibleSheet
          .findAllByType(IconButton)
          .find((node) => node.props.label === 'Đóng')!
          .props.onPress();
      });
      await flush(4);

      // Guest retry ("Thử lại phản hồi") after stream failure also uses nativeFetch without Authorization
      act(() => {
        input().props.onChangeText('Đổi sang 16h nhé');
      });
      await act(async () => {
        sendButton().props.onPress();
      });
      await flush();
      expect(collectText(tree!)).toContain('Mạng chập chờn tạm thời');

      await act(async () => {
        tree!.root
          .findAllByType(Action)
          .find((node) => node.props.label === 'Thử lại phản hồi')!
          .props.onPress();
      });
      await flush();

      const retriedChatCalls = jest
        .mocked(expoFetch)
        .mock.calls.filter(([url]) => url === `${API_ORIGIN}/api/chat`);
      expect(retriedChatCalls).toHaveLength(3);
      expect(getHeader(retriedChatCalls[2][1]?.headers, 'authorization')).toBeNull();
      await waitFor(() => {
        expect(collectText(tree!)).toContain('Đã khôi phục phản hồi cho khách.');
      });
    } finally {
      if (tree) {
        act(() => tree!.unmount());
      }
      await flush(4);
    }
  });

  it('aborts an active guest stream on login, attaches Bearer for signed-in chat, and never downgrades invalid Bearer to anonymous', async () => {
    const now = Date.now();
    const signedInSession = {
      session: 'jwe-mobile-session-token',
      user: { id: 'google-user-1', email: 'user1@example.com', name: 'Người dùng 1' },
      expiresAt: now + 86_400_000,
      accessTokenExpiresAt: now + 3_600_000,
    };

    let guestStreamSignal: AbortSignal | undefined;
    let releaseGuestStream!: () => void;
    let signedInChatAttempt = 0;

    jest.mocked(expoFetch).mockImplementation(async (url, init) => {
      if (url === `${API_ORIGIN}/api/models`) {
        return jsonResponse({ models: [], defaultModel: '' });
      }
      if (url === `${API_ORIGIN}/api/auth/mobile/exchange`) {
        return jsonResponse(signedInSession);
      }
      if (url === `${API_ORIGIN}/api/auth/google/status`) {
        return jsonResponse({
          authenticated: true,
          isConfigured: true,
          user: { email: signedInSession.user.email, name: signedInSession.user.name },
        });
      }
      if (url === `${API_ORIGIN}/api/chat`) {
        const authHeader = getHeader(init?.headers, 'authorization');
        if (!authHeader) {
          guestStreamSignal = init?.signal ?? undefined;
          await new Promise<void>((resolve) => {
            releaseGuestStream = resolve;
            guestStreamSignal?.addEventListener('abort', () => resolve(), { once: true });
          });
          if (guestStreamSignal?.aborted) {
            throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
          }
          return dataStreamResponse([
            formatDataStreamPart('text', 'Phản hồi khách muộn'),
            formatDataStreamPart('finish_message', { finishReason: 'stop' }),
          ]);
        }

        signedInChatAttempt += 1;
        if (signedInChatAttempt === 1) {
          return dataStreamResponse([
            formatDataStreamPart('text', 'Xin chào tài khoản đã đăng nhập!'),
            formatDataStreamPart('finish_message', { finishReason: 'stop' }),
          ]);
        }
        return jsonResponse({ error: 'Phiên không hợp lệ.' }, 401);
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    let tree: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        tree = create(<App />);
      });
      await flush();

      const input = () =>
        tree!.root
          .findAllByType(TextInput)
          .find((node) => node.props.accessibilityLabel === 'Tin nhắn cho Calendai')!;
      const sendButton = () =>
        tree!.root
          .findAllByType(IconButton)
          .find((node) => node.props.label === 'Gửi tin nhắn')!;

      // Start guest stream that stays in-flight while user logs in
      act(() => {
        input().props.onChangeText('Tin nhắn của khách trước khi đăng nhập');
      });
      act(() => {
        sendButton().props.onPress();
      });
      await flush(4);
      expect(guestStreamSignal).toBeDefined();
      expect(guestStreamSignal?.aborted).toBe(false);

      // Sign in -> Workspace remounts by user.id, aborting active guest stream and isolating history
      await act(async () => {
        await authClient.exchange('server-auth-code-1');
      });
      releaseGuestStream?.();
      await flush();

      expect(guestStreamSignal?.aborted).toBe(true);
      expect(collectText(tree!)).not.toContain('Tin nhắn của khách trước khi đăng nhập');

      // Signed-in user sends a message -> attaches Authorization: Bearer <session>
      act(() => {
        input().props.onChangeText('Xem lịch họp sáng mai');
      });
      await act(async () => {
        sendButton().props.onPress();
      });
      await flush();

      const chatCallsAfterFirstSignedIn = jest
        .mocked(expoFetch)
        .mock.calls.filter(([url]) => url === `${API_ORIGIN}/api/chat`);
      expect(chatCallsAfterFirstSignedIn).toHaveLength(2);
      expect(getHeader(chatCallsAfterFirstSignedIn[1][1]?.headers, 'authorization')).toBe(
        `Bearer ${signedInSession.session}`
      );
      await waitFor(() => {
        expect(collectText(tree!)).toContain('Xin chào tài khoản đã đăng nhập!');
      });

      // Signed-in user receives 401 -> clears session without ever retrying anonymously
      act(() => {
        input().props.onChangeText('Tin nhắn khi phiên vừa bị thu hồi');
      });
      await act(async () => {
        sendButton().props.onPress();
      });
      await flush();

      const allChatCalls = jest
        .mocked(expoFetch)
        .mock.calls.filter(([url]) => url === `${API_ORIGIN}/api/chat`);
      expect(allChatCalls).toHaveLength(3);
      expect(getHeader(allChatCalls[2][1]?.headers, 'authorization')).toBe(
        `Bearer ${signedInSession.session}`
      );
      expect(authClient.getSnapshot()).toBeNull();
      expect(collectText(tree!)).not.toContain('Tin nhắn khi phiên vừa bị thu hồi');
    } finally {
      releaseGuestStream?.();
      if (tree) {
        act(() => tree!.unmount());
      }
      await flush(4);
    }
  });

  it('never downgrades expired Bearer sessions to anonymous before fetch and aborts active signed-in streams on logout', async () => {
    const activeSession = (accessTokenTtlMs = 30_000) => {
      const currentNow = Date.now();
      return {
        session: 'jwe-active-mobile-session-token',
        user: { id: 'google-user-2', email: 'user2@example.com', name: 'Người dùng 2' },
        expiresAt: currentNow + 86_400_000,
        accessTokenExpiresAt: currentNow + accessTokenTtlMs,
      };
    };

    let signedInStreamSignal: AbortSignal | undefined;
    let releaseSignedInStream!: () => void;
    let failRefresh = false;
    let refreshedAccessTokenTtlMs = 30_000;

    jest.mocked(expoFetch).mockImplementation(async (url, init) => {
      if (url === `${API_ORIGIN}/api/models`) {
        return jsonResponse({ models: [], defaultModel: '' });
      }
      if (url === `${API_ORIGIN}/api/auth/mobile/exchange`) {
        return jsonResponse(activeSession(refreshedAccessTokenTtlMs));
      }
      if (url === `${API_ORIGIN}/api/auth/mobile/refresh`) {
        if (failRefresh) {
          return jsonResponse({ error: 'Refresh token revoked' }, 401);
        }
        return jsonResponse({
          ...activeSession(refreshedAccessTokenTtlMs),
          session: 'jwe-refreshed-mobile-session-token',
        });
      }
      if (url === `${API_ORIGIN}/api/auth/google/status`) {
        const current = activeSession();
        return jsonResponse({
          authenticated: true,
          isConfigured: true,
          user: { email: current.user.email, name: current.user.name },
        });
      }
      if (url === `${API_ORIGIN}/api/chat`) {
        const authHeader = getHeader(init?.headers, 'authorization');
        if (authHeader) {
          signedInStreamSignal = init?.signal ?? undefined;
          await new Promise<void>((resolve) => {
            releaseSignedInStream = resolve;
            signedInStreamSignal?.addEventListener('abort', () => resolve(), { once: true });
          });
          if (signedInStreamSignal?.aborted) {
            throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
          }
          return dataStreamResponse([
            formatDataStreamPart('text', 'Phản hồi đã đăng nhập'),
            formatDataStreamPart('finish_message', { finishReason: 'stop' }),
          ]);
        }
        return dataStreamResponse([
          formatDataStreamPart('text', 'Phản hồi khách sau khi đăng xuất'),
          formatDataStreamPart('finish_message', { finishReason: 'stop' }),
        ]);
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    let tree: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        await authClient.exchange('server-auth-code-2');
      });
      await act(async () => {
        tree = create(<App />);
      });
      await flush();

      const input = () =>
        tree!.root
          .findAllByType(TextInput)
          .find((node) => node.props.accessibilityLabel === 'Tin nhắn cho Calendai')!;
      const sendButton = () =>
        tree!.root
          .findAllByType(IconButton)
          .find((node) => node.props.label === 'Gửi tin nhắn')!;

      expect(authClient.getSnapshot()?.user.id).toBe('google-user-2');

      // Session is within the 90s refresh window while signed-in Conversation is mounted;
      // refresh fails with 401 before /api/chat -> zero /api/chat calls (never downgraded to guest)
      failRefresh = true;
      jest.mocked(expoFetch).mockClear();
      act(() => {
        input().props.onChangeText('Tin nhắn riêng tư của tài khoản');
      });
      await act(async () => {
        sendButton().props.onPress();
      });
      await flush();

      expect(
        jest.mocked(expoFetch).mock.calls.filter(([url]) => url === `${API_ORIGIN}/api/auth/mobile/refresh`)
      ).toHaveLength(1);
      expect(
        jest.mocked(expoFetch).mock.calls.filter(([url]) => url === `${API_ORIGIN}/api/chat`)
      ).toHaveLength(0);
      expect(authClient.getSnapshot()).toBeNull();

      // Re-login with working refresh, start an active signed-in stream, then logout -> stream aborts & guest chat works
      failRefresh = false;
      refreshedAccessTokenTtlMs = 3_600_000;
      await act(async () => {
        await authClient.exchange('server-auth-code-3');
      });
      await flush();

      act(() => {
        input().props.onChangeText('Đang stream khi đăng xuất');
      });
      act(() => {
        sendButton().props.onPress();
      });
      await flush(4);
      expect(signedInStreamSignal).toBeDefined();
      expect(signedInStreamSignal?.aborted).toBe(false);

      await act(async () => {
        await authClient.clear();
      });
      releaseSignedInStream?.();
      await flush();

      expect(signedInStreamSignal?.aborted).toBe(true);
      expect(collectText(tree!)).not.toContain('Đang stream khi đăng xuất');

      act(() => {
        input().props.onChangeText('Xin chào ở chế độ khách');
      });
      await act(async () => {
        sendButton().props.onPress();
      });
      await flush();

      const guestChatCalls = jest
        .mocked(expoFetch)
        .mock.calls.filter(
          ([url, reqInit]) =>
            url === `${API_ORIGIN}/api/chat` && !getHeader(reqInit?.headers, 'authorization')
        );
      expect(guestChatCalls).toHaveLength(1);
      await waitFor(() => {
        expect(collectText(tree!)).toContain('Phản hồi khách sau khi đăng xuất');
      });
    } finally {
      releaseSignedInStream?.();
      if (tree) {
        act(() => tree!.unmount());
      }
      await flush(4);
    }
  });
});
