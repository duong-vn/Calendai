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
        className="flex max-h-[85dvh] sm:max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl bg-[#fffaf2] shadow-2xl border-2 border-[#2d2015] sm:shadow-[4px_4px_0px_#2d2015] pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0 dark:bg-[#1f1813] dark:border-[#453427] dark:sm:shadow-[4px_4px_0px_#453427]"
      >
        {/* Mobile Drag Handle */}
        <div className="w-10 h-1 bg-[#2d2015]/40 dark:bg-[#453427] rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#2d2015]/20 px-5 sm:px-6 py-3.5 sm:py-4 dark:border-[#453427]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-[#c25e2e] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#211a14] dark:text-[#fbbf24]">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
                Lịch sử hội thoại
              </h3>
              <p className="text-[11px] font-mono text-[#786455] dark:text-[#ba9f88]">
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
              className="flex items-center gap-1 rounded-full border-2 border-[#2d2015] bg-[#c25e2e] px-3 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#a6491e] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#e07a3f] dark:text-[#14110f]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Đoạn chat mới</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#786455] hover:bg-[#ede4d5] transition-all dark:text-[#ba9f88] dark:hover:bg-[#2a221b]"
              aria-label="Đóng lịch sử hội thoại"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-4 pb-2 border-b-2 border-[#2d2015]/20 dark:border-[#453427]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#786455] dark:text-[#ba9f88]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm phiên chat theo tên..."
              className="w-full rounded-xl border-2 border-[#2d2015]/40 bg-[#f5eee1] py-2 pl-9 pr-3 text-xs font-medium text-[#2b1f17] placeholder:text-[#786455] focus:border-[#c25e2e] focus:outline-hidden dark:border-[#453427] dark:bg-[#16120f] dark:text-[#f5ebd9] dark:placeholder:text-[#ba9f88] dark:focus:border-[#e07a3f]"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#786455] dark:text-[#ba9f88]">
              <MessageSquare className="h-8 w-8 text-[#2d2015]/30 mx-auto mb-2 dark:text-[#453427]" />
              <p>Chưa có phiên chat nào phù hợp.</p>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const hasEvents = Object.keys(session.confirmedEvents || {}).length > 0;

              return (
                <div
                  key={session.id}
                  className={`group flex items-center justify-between gap-3 rounded-2xl border-2 p-3 transition-all ${
                    isActive
                      ? 'border-[#2d2015] bg-[#ede4d5] shadow-[2px_2px_0px_#2d2015] dark:border-[#e07a3f] dark:bg-[#2c221a]'
                      : 'border-[#2d2015]/40 bg-[#fffaf2] hover:border-[#2d2015] hover:bg-[#ede4d5] dark:border-[#453427] dark:bg-[#16120f] dark:hover:bg-[#261f18]'
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
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#c25e2e] text-white border border-[#2d2015] dark:bg-[#e07a3f] dark:text-[#14110f]">
                          <Check className="h-3 w-3" />
                        </div>
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#2d2015]/40 bg-[#ede4d5] text-[#786455] dark:border-[#453427] dark:bg-[#211a14] dark:text-[#ba9f88]">
                          <MessageSquare className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="truncate text-xs font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
                        {session.title}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-[#786455] dark:text-[#ba9f88]">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{formatSessionDate(session.updatedAt || session.createdAt)}</span>
                        <span>•</span>
                        <span>{session.messages?.length || 0} tin nhắn</span>
                        {hasEvents && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-[#1f7560] dark:text-[#2dd4bf] font-bold">
                              <Calendar className="h-3 w-3" />
                              <span>Đã in vé</span>
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
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#786455] hover:bg-[#fdf2f0] hover:text-[#cf3e32] transition-all dark:text-[#ba9f88] dark:hover:bg-[#2b1111] dark:hover:text-[#fca5a5]"
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
