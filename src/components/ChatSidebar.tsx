'use client';

import { useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import type { ChatSession } from '@/lib/chat/session-storage';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenUpcoming?: () => void;
  onOpenTips?: () => void;
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

export function ChatSidebar({
  isOpen,
  onToggle,
  onCloseMobile,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onOpenUpcoming,
  onOpenTips,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r-2 border-[#2d2015] bg-[#fffaf2] shadow-2xl transition-all duration-300 ease-in-out lg:static lg:z-20 lg:shadow-none dark:border-[#453427] dark:bg-[#181310] ${
          isOpen
            ? 'w-72 max-w-[85vw] translate-x-0'
            : '-translate-x-full lg:w-0 lg:translate-x-0 lg:overflow-hidden lg:border-r-0'
        }`}
        aria-label="Thanh bên danh sách phiên chat"
      >
        {/* Top Actions: New Chat & Collapse Toggle */}
        <div className="flex items-center gap-2 border-b-2 border-[#2d2015]/20 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-[#453427]">
          <button
            type="button"
            onClick={() => {
              onNewSession();
              onCloseMobile();
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#2d2015] bg-[#c25e2e] py-2 px-3 text-xs font-bold text-white shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#a6491e] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#e07a3f] dark:text-[#14110f]"
          >
            <Plus className="h-4 w-4" />
            <span>Đoạn chat mới</span>
          </button>

          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#2d2015] bg-[#fffaf2] text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427]"
            title="Đóng thanh bên"
            aria-label="Đóng thanh bên"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Search Input Box */}
        <div className="p-3 pb-1.5 border-b border-[#2d2015]/10 dark:border-[#453427]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#786455] dark:text-[#ba9f88]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm phiên chat..."
              className="w-full rounded-xl border-2 border-[#2d2015]/30 bg-[#f5eee1] py-1.5 pl-8 pr-7 text-xs font-medium text-[#2b1f17] placeholder:text-[#786455] focus:border-[#c25e2e] focus:outline-hidden dark:border-[#453427] dark:bg-[#16120f] dark:text-[#f5ebd9] dark:placeholder:text-[#ba9f88] dark:focus:border-[#e07a3f]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#786455] hover:text-[#2b1f17] dark:text-[#ba9f88] dark:hover:text-[#f5ebd9]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-mono font-bold uppercase text-[#786455] dark:text-[#ba9f88]">
            <span>Lịch sử ({filteredSessions.length})</span>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#786455] dark:text-[#ba9f88]">
              <MessageSquare className="h-6 w-6 text-[#2d2015]/30 mx-auto mb-1.5 dark:text-[#453427]" />
              <p>Chưa có phiên chat nào.</p>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const hasEvents = Object.keys(session.confirmedEvents || {}).length > 0;

              return (
                <div
                  key={session.id}
                  className={`group relative flex items-center justify-between gap-1.5 rounded-xl transition-all ${
                    isActive
                      ? 'border-2 border-[#2d2015] bg-[#ede4d5] shadow-[2px_2px_0px_#2d2015] dark:border-[#e07a3f] dark:bg-[#261d17] dark:shadow-[2px_2px_0px_#453427]'
                      : 'border-2 border-transparent hover:border-[#2d2015]/40 hover:bg-[#ede4d5]/60 dark:hover:border-[#453427] dark:hover:bg-[#211a14]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSession(session);
                      onCloseMobile();
                    }}
                    className="flex flex-1 items-start gap-2.5 p-2 text-left min-w-0"
                  >
                    <div className="mt-0.5 shrink-0">
                      <MessageSquare
                        className={`h-3.5 w-3.5 ${
                          isActive
                            ? 'text-[#c25e2e] dark:text-[#e07a3f]'
                            : 'text-[#786455] dark:text-[#ba9f88]'
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      <h4 className="truncate text-xs font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
                        {session.title}
                      </h4>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#786455] dark:text-[#ba9f88]">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{formatSessionDate(session.updatedAt || session.createdAt)}</span>
                        {hasEvents && (
                          <span
                            title="Có cuộc họp đã tạo"
                            className="flex items-center text-[#1f7560] dark:text-[#2dd4bf]"
                          >
                            • <Calendar className="h-3 w-3 ml-1" />
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    aria-label={`Xóa phiên chat: ${session.title}`}
                    title="Xóa phiên chat"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-[#786455] opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover:opacity-100 hover:bg-[#fdf2f0] hover:text-[#cf3e32] transition-all focus:opacity-100 dark:text-[#ba9f88] dark:hover:bg-[#2b1111] dark:hover:text-[#fca5a5]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Shortcuts */}
        <div className="border-t-2 border-[#2d2015]/20 p-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-1 dark:border-[#453427]">
          {onOpenUpcoming && (
            <button
              type="button"
              onClick={() => {
                onOpenUpcoming();
                onCloseMobile();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#2b1f17] hover:bg-[#ede4d5] transition-colors dark:text-[#f5ebd9] dark:hover:bg-[#211a14]"
            >
              <Video className="h-4 w-4 text-[#1f7560] dark:text-[#2dd4bf]" />
              <span>Xem lịch trình sắp tới</span>
            </button>
          )}

          {onOpenTips && (
            <button
              type="button"
              onClick={() => {
                onOpenTips();
                onCloseMobile();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#2b1f17] hover:bg-[#ede4d5] transition-colors dark:text-[#f5ebd9] dark:hover:bg-[#211a14]"
            >
              <Sparkles className="h-4 w-4 text-[#d49439] dark:text-[#fbbf24]" />
              <span>Cẩm nang mẹo đặt lịch</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
