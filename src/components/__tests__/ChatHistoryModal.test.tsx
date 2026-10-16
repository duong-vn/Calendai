import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatSession } from '@/lib/chat/session-storage';
import { ChatHistoryModal } from '../ChatHistoryModal';

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

describe('ChatHistoryModal Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders session list when open', () => {
    render(
      <ChatHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        sessions={MOCK_SESSIONS}
        activeSessionId="s-1"
        onSelectSession={vi.fn()}
        onNewSession={vi.fn()}
        onDeleteSession={vi.fn()}
      />
    );

    expect(screen.getByText('Họp Sprint Review')).toBeInTheDocument();
    expect(screen.getByText('Gặp gỡ khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Lịch sử hội thoại')).toBeInTheDocument();
  });

  it('filters sessions using search input', () => {
    render(
      <ChatHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        sessions={MOCK_SESSIONS}
        activeSessionId="s-1"
        onSelectSession={vi.fn()}
        onNewSession={vi.fn()}
        onDeleteSession={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Tìm kiếm phiên chat/i);
    fireEvent.change(searchInput, { target: { value: 'Sprint' } });

    expect(screen.getByText('Họp Sprint Review')).toBeInTheDocument();
    expect(screen.queryByText('Gặp gỡ khách hàng')).not.toBeInTheDocument();
  });

  it('calls onSelectSession and onClose when a session is clicked', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <ChatHistoryModal
        isOpen={true}
        onClose={handleClose}
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
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onDeleteSession when delete button is clicked', () => {
    const handleDelete = vi.fn();

    render(
      <ChatHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        sessions={MOCK_SESSIONS}
        activeSessionId="s-1"
        onSelectSession={vi.fn()}
        onNewSession={vi.fn()}
        onDeleteSession={handleDelete}
      />
    );

    const deleteBtns = screen.getAllByTitle('Xóa phiên chat này');
    fireEvent.click(deleteBtns[0]);

    expect(handleDelete).toHaveBeenCalledWith('s-1');
  });
});
