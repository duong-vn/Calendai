'use client';

import { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { ChatSession } from '@/lib/chat/session-storage';

interface ChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
}

function formatSessionDate(timestamp: number): string {
  try {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const timeStr = new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);

    if (isToday) {
      return `Hôm nay, ${timeStr}`;
    }

    const dateStr = new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
    }).format(d);

    return `${dateStr}, ${timeStr}`;
  } catch {
    return '';
  }
}

export function ChatHistoryModal({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: ChatHistoryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-label="Lịch sử các phiên chat"
        className="flex max-h-[85dvh] sm:max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border-t sm:border border-[#dadce0] pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0 dark:bg-[#131d18] dark:border-[#23382d]"
      >
        {/* Mobile Drag Handle */}
        <div className="w-10 h-1 bg-[#dadce0] dark:bg-[#23382d] rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dadce0]/60 px-5 sm:px-6 py-3.5 sm:py-4 dark:border-[#23382d]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#132c21] dark:text-[#10b981]">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-medium text-[#1f1f1f] dark:text-[#f1f5f9]">
                Lịch sử hội thoại
              </h3>
              <p className="text-[11px] text-[#5f6368] dark:text-[#94a3b8]">
                {sessions.length} phiên chat đã lưu trên trình duyệt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onNewSession();
                onClose();
              }}
              className="flex items-center gap-1 rounded-full bg-[#1a73e8] px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-[#1557b0] active:scale-95 dark:bg-[#059669] dark:hover:bg-[#047857]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Đoạn chat mới</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4] transition-all dark:text-[#94a3b8] dark:hover:bg-[#1c2e26]"
              aria-label="Đóng lịch sử hội thoại"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-4 pb-2 border-b border-[#dadce0]/40 dark:border-[#23382d]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5f6368] dark:text-[#94a3b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm phiên chat theo tên..."
              className="w-full rounded-xl border border-[#dadce0] bg-[#f8fafd] py-2 pl-9 pr-3 text-xs text-[#1f1f1f] placeholder:text-[#5f6368] focus:border-[#1a73e8] focus:outline-hidden dark:border-[#23382d] dark:bg-[#16221d] dark:text-[#f1f5f9] dark:placeholder:text-[#94a3b8] dark:focus:border-[#10b981]"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#5f6368] dark:text-[#94a3b8]">
              <MessageSquare className="h-8 w-8 text-[#dadce0] mx-auto mb-2 dark:text-[#23382d]" />
              <p>Chưa có phiên chat nào phù hợp.</p>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const hasEvents = Object.keys(session.confirmedEvents || {}).length > 0;

              return (
                <div
                  key={session.id}
                  className={`group flex items-center justify-between gap-3 rounded-2xl border p-3 transition-all ${
                    isActive
                      ? 'border-[#1a73e8] bg-[#e8f0fe]/60 shadow-xs dark:border-[#10b981] dark:bg-[#12281e]'
                      : 'border-[#dadce0] bg-[#f8fafd] hover:border-[#1a73e8]/60 hover:bg-white dark:border-[#23382d] dark:bg-[#16221d] dark:hover:bg-[#1b2b23]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSession(session);
                      onClose();
                    }}
                    className="flex flex-1 items-start gap-2.5 text-left min-w-0"
                  >
                    <div className="mt-0.5">
                      {isActive ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a73e8] text-white dark:bg-[#10b981] dark:text-[#101714]">
                          <Check className="h-3 w-3" />
                        </div>
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#dadce0] bg-white text-[#5f6368] dark:border-[#23382d] dark:bg-[#131d18] dark:text-[#94a3b8]">
                          <MessageSquare className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="truncate text-xs font-semibold text-[#1f1f1f] dark:text-[#f1f5f9]">
                        {session.title}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-[#5f6368] dark:text-[#94a3b8]">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{formatSessionDate(session.updatedAt || session.createdAt)}</span>
                        <span>•</span>
                        <span>{session.messages?.length || 0} tin nhắn</span>
                        {hasEvents && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-[#34a853] dark:text-[#34d399] font-medium">
                              <Calendar className="h-3 w-3" />
                              <span>Lịch đã tạo</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteSession(session.id)}
                    aria-label={`Xóa phiên chat: ${session.title}`}
                    title="Xóa phiên chat này"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#5f6368] hover:bg-[#fce8e6] hover:text-[#c5221f] transition-all dark:text-[#94a3b8] dark:hover:bg-[#2b1111] dark:hover:text-[#fca5a5]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
