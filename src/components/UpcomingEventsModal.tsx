'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  Calendar,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import type { UpcomingEventItem } from '@/lib/calendar/types';
import { UpcomingEventCard } from './UpcomingEventCard';
import { WeeklyCalendar } from './WeeklyCalendar';

interface UpcomingEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpcomingEventsModal({ isOpen, onClose }: UpcomingEventsModalProps) {
  const [events, setEvents] = useState<UpcomingEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'upcoming' | 'week'>('upcoming');
  const dialog = useRef<HTMLDialogElement>(null);
  const upcomingRequest = useRef<AbortController>(null);
  const titleId = useId();

  const fetchEvents = async () => {
    upcomingRequest.current?.abort();
    const abort = new AbortController();
    upcomingRequest.current = abort;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/calendar/upcoming', { signal: abort.signal });
      const data = await res.json();
      if (abort.signal.aborted) return;
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể tải lịch trình.');
      }
      setEvents(data.events || []);
    } catch (err) {
      if (!abort.signal.aborted) setError(err instanceof Error ? err.message : 'Lỗi lấy danh sách sự kiện');
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && view === 'upcoming') {
      void fetchEvents();
      return () => upcomingRequest.current?.abort();
    }
  }, [isOpen, view]);

  useEffect(() => {
    const modal = dialog.current;
    if (!isOpen || !modal) return;
    modal.showModal();
    return () => modal.close();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none items-end justify-center bg-transparent p-0 open:flex sm:items-center sm:p-4 backdrop:bg-black/50 backdrop:backdrop-blur-xs">
      <div className={`flex max-h-[85dvh] w-full flex-col rounded-t-3xl sm:rounded-3xl bg-[#fffaf2] shadow-2xl border-2 border-[#2d2015] sm:shadow-[4px_4px_0px_#2d2015] pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0 dark:bg-[#1f1813] dark:border-[#453427] dark:sm:shadow-[4px_4px_0px_#453427] ${view === 'week' ? 'h-[85dvh] max-w-6xl' : 'max-w-xl'}`}>
        <div className="w-10 h-1 bg-[#2d2015]/40 dark:bg-[#453427] rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />
        {/* Header */}
        <div className="shrink-0 flex gap-2 items-center justify-between border-b-2 border-[#2d2015]/20 px-5 sm:px-6 py-3.5 sm:py-4 dark:border-[#453427]">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-[#c25e2e] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#211a14] dark:text-[#fbbf24]">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 id={titleId} className="text-base font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
                Bảng Lịch Trình Hơi Nước
              </h3>
              <p className="text-[11px] font-mono text-[#786455] dark:text-[#ba9f88]">
                Sự kiện đồng bộ trực tiếp từ Google Calendar
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {view === 'upcoming' && <button
              type="button"
              onClick={fetchEvents}
              disabled={loading}
              className="flex h-9 w-9 min-h-[36px] min-w-[36px] touch-manipulation items-center justify-center rounded-full text-[#786455] hover:bg-[#ede4d5] transition-all active:scale-95 disabled:opacity-50 dark:text-[#ba9f88] dark:hover:bg-[#2a221b]"
              title="Làm mới"
              aria-label="Làm mới lịch trình"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 min-h-[36px] min-w-[36px] touch-manipulation items-center justify-center rounded-full text-[#786455] hover:bg-[#ede4d5] transition-all active:scale-95 dark:text-[#ba9f88] dark:hover:bg-[#2a221b]"
              title="Đóng"
              aria-label="Đóng cửa sổ lịch trình"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div role="group" aria-label="Chế độ xem lịch" className="flex shrink-0 gap-2 border-b border-[#2d2015]/15 px-4 py-2 sm:px-6 dark:border-[#453427]">
          {(['upcoming', 'week'] as const).map(mode => (
            <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)}
              className="min-h-9 rounded-lg px-3 text-sm font-semibold text-[#2b1f17] hover:bg-[#ede4d5] aria-pressed:bg-[#ede4d5] dark:text-[#f5ebd9] dark:hover:bg-[#34281f] dark:aria-pressed:bg-[#34281f]">
              {mode === 'week' ? 'Lịch tuần' : 'Sắp tới'}
            </button>
          ))}
        </div>

        {/* Content */}
        {view === 'week' ? <WeeklyCalendar /> : <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-[#786455] dark:text-[#ba9f88]">
              <Loader2 className="h-6 w-6 animate-spin text-[#c25e2e] dark:text-[#e07a3f]" />
              <span className="text-xs font-semibold">Đang quay bánh răng tải lịch...</span>
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-[#fdf2f0] p-4 text-xs font-medium text-[#a63024] border-2 border-[#cf3e32] shadow-[2px_2px_0px_#cf3e32] dark:border-[#ef4444] dark:bg-[#2b1614] dark:text-[#f87171]">
              <span className="font-bold">Thông báo: </span>
              {error}
            </div>
          ) : events.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center text-[#786455] dark:text-[#ba9f88]">
              <Calendar className="h-10 w-10 text-[#2d2015]/30 mb-2 dark:text-[#453427]" />
              <p className="min-w-0 [overflow-wrap:anywhere] text-sm font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
                Chưa có sự kiện nào sắp tới
              </p>
              <p className="text-xs text-[#786455] mt-1 dark:text-[#ba9f88]">
                Yêu cầu Calendai lên lịch họp mới bất cứ lúc nào.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((evt) => (
                <UpcomingEventCard key={evt.id} event={evt} />
              ))}
            </div>
          )}
        </div>}
      </div>
    </dialog>
  );
}
