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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex h-full max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              Lịch Trình Sắp Tới
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchEvents}
              disabled={loading}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition disabled:opacity-50"
              title="Làm mới"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
              title="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-xs">Đang tải danh sách sự kiện...</span>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-rose-50 p-4 text-xs text-rose-700">
              <span className="font-semibold">Thông báo: </span>
              {error}
            </div>
          ) : events.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center text-slate-400">
              <Calendar className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">
                Không có sự kiện nào sắp tới
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Bạn có thể yêu cầu Calendai lên lịch họp mới bất cứ lúc nào.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      {evt.summary}
                    </h4>
                    <a
                      href={evt.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-blue-600 transition"
                      title="Xem trên Google Calendar"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{formatEventTime(evt.start)}</span>
                  </div>

                  {evt.hangoutLink && (
                    <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                        <Video className="h-3.5 w-3.5" />
                        <span>Google Meet</span>
                      </div>
                      <a
                        href={evt.hangoutLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition"
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
