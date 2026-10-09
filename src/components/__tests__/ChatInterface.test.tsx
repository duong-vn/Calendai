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

  it('renders helpful fallback with retry button when assistant message is empty and not loading', () => {
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
      error: undefined,
      reload: mockReload,
      setInput: vi.fn(),
    });

    render(<ChatInterface isAuthenticated={true} />);

    expect(
      screen.getByText('Chưa nhận được phản hồi từ trợ lý AI.')
    ).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(mockReload).toHaveBeenCalledTimes(1);
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
});
