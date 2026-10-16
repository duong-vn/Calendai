import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatSession } from '@/lib/chat/session-storage';
import { ChatSidebar } from '../ChatSidebar';

const MOCK_SESSIONS: ChatSession[] = [
  {
    id: 's-1',
    title: 'Họp Sprint Review',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 1800000,
    messages: [{ id: 'm1', role: 'user', content: 'Họp Sprint Review' }],
    confirmedEvents: {},
  },
  {
    id: 's-2',
    title: 'Gặp gỡ khách hàng',
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 3600000,
    messages: [{ id: 'm2', role: 'user', content: 'Gặp gỡ khách hàng' }],
    confirmedEvents: {},
  },
];

describe('ChatSidebar Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders sidebar session items when open', () => {
    render(
      <ChatSidebar
        isOpen={true}
        onToggle={vi.fn()}
        onCloseMobile={vi.fn()}
        sessions={MOCK_SESSIONS}
        activeSessionId="s-1"
        onSelectSession={vi.fn()}
        onNewSession={vi.fn()}
        onDeleteSession={vi.fn()}
      />
    );

    expect(screen.getByText('Họp Sprint Review')).toBeInTheDocument();
    expect(screen.getByText('Gặp gỡ khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Đoạn chat mới')).toBeInTheDocument();
  });

  it('filters sessions using search input', () => {
    render(
      <ChatSidebar
        isOpen={true}
        onToggle={vi.fn()}
        onCloseMobile={vi.fn()}
        sessions={MOCK_SESSIONS}
        activeSessionId="s-1"
        onSelectSession={vi.fn()}
        onNewSession={vi.fn()}
        onDeleteSession={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Tìm phiên chat/i);
    fireEvent.change(searchInput, { target: { value: 'Sprint' } });

    expect(screen.getByText('Họp Sprint Review')).toBeInTheDocument();
    expect(screen.queryByText('Gặp gỡ khách hàng')).not.toBeInTheDocument();
  });

  it('calls onSelectSession when a session item is clicked', () => {
    const handleSelect = vi.fn();
    const handleCloseMobile = vi.fn();

    render(
      <ChatSidebar
        isOpen={true}
        onToggle={vi.fn()}
        onCloseMobile={handleCloseMobile}
        sessions={MOCK_SESSIONS}
        activeSessionId="s-1"
        onSelectSession={handleSelect}
        onNewSession={vi.fn()}
        onDeleteSession={vi.fn()}
      />
    );

    const sessionBtn = screen.getByText('Gặp gỡ khách hàng');
    fireEvent.click(sessionBtn);

    expect(handleSelect).toHaveBeenCalledWith(MOCK_SESSIONS[1]);
    expect(handleCloseMobile).toHaveBeenCalled();
  });

  it('calls onNewSession when new chat button is clicked', () => {
    const handleNew = vi.fn();

    render(
      <ChatSidebar
        isOpen={true}
        onToggle={vi.fn()}
        onCloseMobile={vi.fn()}
        sessions={MOCK_SESSIONS}
        activeSessionId="s-1"
        onSelectSession={vi.fn()}
        onNewSession={handleNew}
        onDeleteSession={vi.fn()}
      />
    );

    const newBtn = screen.getByText('Đoạn chat mới');
    fireEvent.click(newBtn);

    expect(handleNew).toHaveBeenCalled();
  });

  it('calls onDeleteSession when delete button is clicked', () => {
    const handleDelete = vi.fn();

    render(
      <ChatSidebar
        isOpen={true}
        onToggle={vi.fn()}
        onCloseMobile={vi.fn()}
        sessions={MOCK_SESSIONS}
        activeSessionId="s-1"
        onSelectSession={vi.fn()}
        onNewSession={vi.fn()}
        onDeleteSession={handleDelete}
      />
    );

    const deleteBtns = screen.getAllByTitle('Xóa phiên chat');
    fireEvent.click(deleteBtns[0]);

    expect(handleDelete).toHaveBeenCalledWith('s-1');
  });

  it('calls onToggle when collapse button is clicked', () => {
    const handleToggle = vi.fn();

    render(
      <ChatSidebar
        isOpen={true}
        onToggle={handleToggle}
        onCloseMobile={vi.fn()}
        sessions={MOCK_SESSIONS}
        activeSessionId="s-1"
        onSelectSession={vi.fn()}
        onNewSession={vi.fn()}
        onDeleteSession={vi.fn()}
      />
    );

    const collapseBtn = screen.getByLabelText('Đóng thanh bên');
    fireEvent.click(collapseBtn);

    expect(handleToggle).toHaveBeenCalled();
  });
});
