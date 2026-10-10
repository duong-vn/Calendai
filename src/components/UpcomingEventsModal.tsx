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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex h-full max-h-[85vh] w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl border border-[#dadce0] dark:bg-[#17241e] dark:border-[#23382d]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f1f3f4] px-6 py-4 dark:border-[#23382d]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#132c21] dark:text-[#10b981]">
              <Calendar className="h-4 w-4" />
            </div>
            <h3 className="text-base font-medium text-[#1f1f1f] dark:text-[#f1f5f9]">
              Lịch trình sắp tới
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchEvents}
              disabled={loading}
              className="rounded-full p-2 text-[#5f6368] hover:bg-[#f1f3f4] transition-colors disabled:opacity-50 dark:text-[#94a3b8] dark:hover:bg-[#1c2e26] dark:hover:text-[#f1f5f9]"
              title="Làm mới"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-[#5f6368] hover:bg-[#f1f3f4] transition-colors dark:text-[#94a3b8] dark:hover:bg-[#1c2e26] dark:hover:text-[#f1f5f9]"
              title="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-[#5f6368] dark:text-[#94a3b8]">
              <Loader2 className="h-6 w-6 animate-spin text-[#1a73e8] dark:text-[#10b981]" />
              <span className="text-xs">Đang tải sự kiện...</span>
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-[#fce8e6] p-4 text-xs text-[#c5221f] border border-[#fad2cf] dark:border-[#7f1d1d] dark:bg-[#2b1111] dark:text-[#fca5a5]">
              <span className="font-semibold">Thông báo: </span>
              {error}
            </div>
          ) : events.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center text-[#5f6368] dark:text-[#94a3b8]">
              <Calendar className="h-10 w-10 text-[#bdc1c6] mb-2 dark:text-[#23382d]" />
              <p className="text-sm font-medium text-[#1f1f1f] dark:text-[#f1f5f9]">
                Chưa có sự kiện nào sắp tới
              </p>
              <p className="text-xs text-[#747775] mt-1 dark:text-[#94a3b8]">
                Yêu cầu Calendai lên lịch họp mới bất cứ lúc nào.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-2xl border border-[#dadce0] bg-[#f8fafd] p-4 transition-colors hover:bg-white dark:border-[#23382d] dark:bg-[#1c2e26] dark:hover:bg-[#20342b]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-[#1f1f1f] dark:text-[#f1f5f9]">
                      {evt.summary}
                    </h4>
                    <a
                      href={evt.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#747775] hover:text-[#1a73e8] transition-colors dark:text-[#94a3b8] dark:hover:text-[#34d399]"
                      title="Mở trên Google Calendar"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-[#5f6368] dark:text-[#94a3b8]">
                    <Clock className="h-3.5 w-3.5 text-[#1a73e8] shrink-0 dark:text-[#10b981]" />
                    <span>{formatEventTime(evt.start)}</span>
                  </div>

                  {evt.hangoutLink && (
                    <div className="mt-3 flex items-center justify-between border-t border-[#edf2fa] pt-2.5 dark:border-[#23382d]">
                      <div className="flex items-center gap-1.5 text-xs text-[#0f9d58] dark:text-[#34d399]">
                        <Video className="h-3.5 w-3.5" />
                        <span className="font-medium">Google Meet</span>
                      </div>
                      <a
                        href={evt.hangoutLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-[#00897b] px-3.5 py-1 text-xs font-medium text-white hover:bg-[#00796b] transition-colors dark:bg-[#059669] dark:hover:bg-[#047857]"
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
