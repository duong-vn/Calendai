'use client';

import { Calendar, CheckCircle2, Clock, LogOut, Video } from 'lucide-react';
import type { UserProfile } from '@/lib/auth/types';

interface HeaderProps {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isConfigured: boolean;
  onOpenUpcoming: () => void;
  onLogout: () => void;
}

export function Header({
  user,
  isAuthenticated,
  isConfigured,
  onOpenUpcoming,
  onLogout,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:px-6">
      {/* Brand logo & title */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              Calendai
            </h1>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
              Trợ lý Lịch AI
            </span>
          </div>
          <div className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
            <Clock className="h-3 w-3" />
            <span>GMT+7 (Asia/Ho_Chi_Minh)</span>
          </div>
        </div>
      </div>

      {/* Right actions: Upcoming meetings & Google Auth */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenUpcoming}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 sm:text-sm"
        >
          <Video className="h-4 w-4 text-emerald-600" />
          <span className="hidden sm:inline">Lịch sắp tới</span>
          <span className="sm:hidden">Lịch</span>
        </button>

        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-1.5 pr-2.5">
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.picture}
                  alt={user.name}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden flex-col sm:flex">
                <span className="max-w-[120px] truncate text-xs font-semibold text-slate-800">
                  {user.name}
                </span>
              </div>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Đăng xuất"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <a
            href="/api/auth/google"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:text-sm"
          >
            <span>Kết nối Google</span>
            {!isConfigured && (
              <span className="rounded bg-blue-700 px-1 py-0.2 text-[10px] text-blue-100">
                Mock
              </span>
            )}
          </a>
        )}
      </div>
    </header>
  );
}
