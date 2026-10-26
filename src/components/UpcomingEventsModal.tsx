'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Video,
  X,
} from 'lucide-react';
import type { UpcomingEventItem } from '@/lib/calendar/types';

interface UpcomingEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpcomingEventsModal({ isOpen, onClose }: UpcomingEventsModalProps) {
  const [events, setEvents] = useState<UpcomingEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/calendar/upcoming');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể tải lịch trình.');
      }
      setEvents(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lấy danh sách sự kiện');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEvents();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatEventTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex max-h-[85dvh] sm:max-h-[85dvh] w-full max-w-xl flex-col rounded-t-3xl sm:rounded-3xl bg-[#fffaf2] shadow-2xl border-2 border-[#2d2015] sm:shadow-[4px_4px_0px_#2d2015] pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0 dark:bg-[#1f1813] dark:border-[#453427] dark:sm:shadow-[4px_4px_0px_#453427]">
        <div className="w-10 h-1 bg-[#2d2015]/40 dark:bg-[#453427] rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />
        {/* Header */}
        <div className="shrink-0 flex flex-wrap gap-3 items-center justify-between border-b-2 border-[#2d2015]/20 px-5 sm:px-6 py-3.5 sm:py-4 dark:border-[#453427]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-[#c25e2e] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#211a14] dark:text-[#fbbf24]">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
                Bảng Lịch Trình Hơi Nước
              </h3>
              <p className="text-[11px] font-mono text-[#786455] dark:text-[#ba9f88]">
                Sự kiện đồng bộ trực tiếp từ Google Calendar
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchEvents}
              disabled={loading}
              className="flex h-9 w-9 min-h-[36px] min-w-[36px] touch-manipulation items-center justify-center rounded-full text-[#786455] hover:bg-[#ede4d5] transition-all active:scale-95 disabled:opacity-50 dark:text-[#ba9f88] dark:hover:bg-[#2a221b]"
              title="Làm mới"
              aria-label="Làm mới lịch trình"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
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

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
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
                <div
                  key={evt.id}
                  className="rounded-2xl border-2 border-[#2d2015] bg-[#fffaf2] p-4 shadow-[2px_2px_0px_#2d2015] transition-all hover:border-[#c25e2e] dark:border-[#453427] dark:bg-[#16120f] dark:hover:border-[#e07a3f]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="min-w-0 [overflow-wrap:anywhere] text-sm font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
                      {evt.summary}
                    </h4>
                    <a
                      href={evt.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#786455] hover:text-[#c25e2e] transition-colors dark:text-[#ba9f88] dark:hover:text-[#e07a3f]"
                      title="Mở trên Google Calendar"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#786455] dark:text-[#ba9f88]">
                    <Clock className="h-3.5 w-3.5 text-[#c25e2e] shrink-0 dark:text-[#e07a3f]" />
                    <span>{formatEventTime(evt.start)}</span>
                  </div>

                  {evt.hangoutLink && (
                    <div className="mt-3 flex flex-wrap gap-3 items-center justify-between border-t-2 border-[#2d2015]/10 pt-2.5 dark:border-[#453427]">
                      <div className="flex items-center gap-1.5 text-xs text-[#1f7560] dark:text-[#2dd4bf]">
                        <Video className="h-3.5 w-3.5" />
                        <span className="font-bold">Google Meet</span>
                      </div>
                      <a
                        href={evt.hangoutLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border-2 border-[#2d2015] bg-[#1f7560] px-3.5 py-1 text-xs font-bold text-white shadow-[2px_2px_0px_#2d2015] hover:bg-[#165a4a] transition-all active:translate-x-[1px] active:translate-y-[1px] dark:border-[#453427] dark:bg-[#2dd4bf] dark:text-[#14110f]"
                      >
                        Tham gia
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
