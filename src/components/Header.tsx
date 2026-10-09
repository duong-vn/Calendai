'use client';

import {
  Calendar,
  CheckCircle2,
  Globe,
  LogOut,
  Sparkles,
  Video,
} from 'lucide-react';
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
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#e1e3e1]/80 bg-white/90 px-4 backdrop-blur-md sm:px-6">
      {/* Brand logo in Google Style */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f0f4f9] text-[#1a73e8] shadow-xs">
          <Calendar className="h-5 w-5" />
          {/* Subtle Google 4-color dots in corner */}
          <div className="absolute -bottom-0.5 -right-0.5 flex gap-0.5 rounded-full bg-white p-0.5 shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4285f4]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#ea4335]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#fbbc04]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#34a853]" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xl font-medium tracking-tight text-[#1f1f1f]">
            Calendai
          </span>
          <span className="hidden rounded-full bg-[#e8f0fe] px-2.5 py-0.5 text-[11px] font-medium text-[#1967d2] sm:inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-[#1a73e8]" />
            Workspace AI
          </span>
        </div>
      </div>

      {/* Center info: Timezone */}
      <div className="hidden md:flex items-center gap-1.5 rounded-full bg-[#f0f4f9] px-3 py-1 text-xs font-medium text-[#444746]">
        <Globe className="h-3.5 w-3.5 text-[#1a73e8]" />
        <span>Hà Nội (GMT+7)</span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenUpcoming}
          className="flex items-center gap-2 rounded-full border border-[#dadce0] bg-white px-3.5 py-1.5 text-xs font-medium text-[#3c4043] transition-colors hover:bg-[#f1f3f4] sm:text-sm"
        >
          <Video className="h-4 w-4 text-[#00897b]" />
          <span>Lịch trình</span>
        </button>

        {isAuthenticated && user ? (
          <div className="flex items-center gap-1.5 rounded-full border border-[#dadce0] bg-[#f8fafd] py-1 pl-1.5 pr-2">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.picture}
                alt={user.name}
                className="h-7 w-7 rounded-full object-cover ring-1 ring-white"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a73e8] text-xs font-medium text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden max-w-[110px] truncate text-xs font-medium text-[#1f1f1f] sm:inline">
              {user.name}
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#34a853]" />
            <button
              type="button"
              onClick={onLogout}
              title="Đăng xuất"
              className="ml-1 rounded-full p-1 text-[#5f6368] hover:bg-[#e8eaed] transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <a
            href="/api/auth/google"
            className="flex items-center gap-2 rounded-full bg-[#1a73e8] px-4 py-1.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-[#1557b0] sm:text-sm"
          >
            {/* Google G icon */}
            <svg className="h-4 w-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.645-5.2 3.645-9.15z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.13 0-5.78-2.11-6.73-4.96H1.21v3.15C3.25 21.36 7.35 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.21C.44 8.14 0 9.99 0 12s.44 3.86 1.21 5.39l4.06-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.25 2.64 1.21 6.61l4.06 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            <span>Kết nối Google</span>
            {!isConfigured && (
              <span className="rounded-full bg-[#1557b0] px-1.5 py-0.2 text-[10px] text-blue-100">
                Mock
              </span>
            )}
          </a>
        )}
      </div>
    </header>
  );
}
