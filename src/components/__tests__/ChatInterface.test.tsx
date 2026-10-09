import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatInterface } from '../ChatInterface';

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
});
