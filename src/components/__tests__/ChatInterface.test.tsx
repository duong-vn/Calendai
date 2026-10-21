import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from 'ai';
import type { Dispatch, SetStateAction } from 'react';
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
  useChat: () => mockUseChat(),
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
    expect(mockSetMessages).toHaveBeenCalledWith([]);
    expect(mockClearSession).toHaveBeenCalled();
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
