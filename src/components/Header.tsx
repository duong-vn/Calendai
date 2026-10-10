'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  FileText,
  Globe,
  LogOut,
  Moon,
  Shield,
  Sparkles,
  Sun,
  Video,
} from 'lucide-react';
import type { UserProfile } from '@/lib/auth/types';

interface HeaderProps {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isConfigured: boolean;
  onOpenUpcoming: () => void;
  onOpenTips?: () => void;
  onLogout: () => void;
}

export function Header({
  user,
  isAuthenticated,
  isConfigured,
  onOpenUpcoming,
  onOpenTips,
  onLogout,
}: HeaderProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('calendai_theme', 'dark');
      } catch {
        // Fallback
      }
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('calendai_theme', 'light');
      } catch {
        // Fallback
      }
    }
  };

  return (
    <header className="sticky top-0 z-30 relative flex h-14 sm:h-16 w-full shrink-0 items-center justify-between border-b border-[#e1e3e1]/80 bg-white/95 px-3 sm:px-6 backdrop-blur-md transition-colors dark:border-[#1e3027] dark:bg-[#111915]/95">
      {/* Brand logo from public/assets/logo.png */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
          <div className="relative flex h-8.5 w-8.5 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-white p-1 border border-[#dadce0] shadow-xs group-hover:border-[#1a73e8] transition-colors overflow-hidden shrink-0 dark:bg-[#17241e] dark:border-[#23382d] dark:group-hover:border-[#10b981]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logo.png"
              alt="Calendai Logo"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              id="header-app-name"
              className="text-lg sm:text-xl font-medium tracking-tight text-[#1f1f1f] dark:text-[#f1f5f9]"
            >
              Calendai
            </span>
            <span className="hidden rounded-full bg-[#e8f0fe] px-2.5 py-0.5 text-[11px] font-medium text-[#1967d2] sm:inline-flex items-center gap-1 dark:bg-[#132c21] dark:text-[#34d399] dark:border dark:border-[#23382d]">
              <Sparkles className="h-3 w-3 text-[#1a73e8] dark:text-[#10b981]" />
              Trợ lý AI
            </span>
          </div>
        </Link>
      </div>

      {/* Center info: Timezone (True absolute center on large screens) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex items-center gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#f0f4f9] px-3 py-1 text-xs font-medium text-[#444746] shadow-2xs border border-[#dadce0]/50 dark:bg-[#17241e] dark:text-[#cbd5e1] dark:border-[#23382d]">
          <Globe className="h-3.5 w-3.5 text-[#1a73e8] dark:text-[#10b981]" />
          <span>Hà Nội (GMT+7)</span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Dark Mode Toggle (Loki / Doctor Doom Emerald Theme) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-8.5 w-8.5 items-center justify-center rounded-full border border-[#dadce0] bg-white text-xs font-medium text-[#3c4043] transition-colors hover:bg-[#f1f3f4] hover:text-[#1a73e8] dark:border-[#23382d] dark:bg-[#17241e] dark:text-[#cbd5e1] dark:hover:bg-[#1d2f26] dark:hover:text-[#34d399]"
          title={isDark ? 'Chuyển sang giao diện Sáng' : 'Giao diện Tối Loki / Doom'}
          aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Giao diện Tối Loki / Doom'}
        >
          {isDark ? (
            <Sun className="h-4 w-4 text-[#fbbf24] hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="h-4 w-4 text-[#10b981] hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* Button: Mẹo nâng cao (opens Sidenote) */}
        {onOpenTips && (
          <button
            type="button"
            onClick={onOpenTips}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-full border border-[#dadce0] bg-white text-xs font-medium text-[#3c4043] transition-colors hover:bg-[#f1f3f4] hover:text-[#1a73e8] sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5 dark:border-[#23382d] dark:bg-[#17241e] dark:text-[#f1f5f9] dark:hover:bg-[#1d2f26] dark:hover:text-[#34d399]"
            title="Xem mẹo đặt lịch & các tham số nâng cao"
            aria-label="Xem mẹo đặt lịch"
          >
            <Sparkles className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#fbbc04] dark:text-[#fbbf24]" />
            <span className="hidden sm:inline">Mẹo nâng cao</span>
          </button>
        )}

        {/* Buttons to Privacy and Terms (Desktop/Tablet only) */}
        <Link
          href="/privacy"
          className="hidden md:flex items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-3 py-1.5 text-xs font-medium text-[#3c4043] transition-colors hover:bg-[#f1f3f4] hover:text-[#1a73e8] dark:border-[#23382d] dark:bg-[#17241e] dark:text-[#cbd5e1] dark:hover:bg-[#1d2f26] dark:hover:text-[#34d399]"
          title="Chính sách quyền riêng tư"
        >
          <Shield className="h-3.5 w-3.5 text-[#1a73e8] dark:text-[#10b981]" />
          <span>Chính sách</span>
        </Link>

        <Link
          href="/terms"
          className="hidden md:flex items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-3 py-1.5 text-xs font-medium text-[#3c4043] transition-colors hover:bg-[#f1f3f4] hover:text-[#1a73e8] dark:border-[#23382d] dark:bg-[#17241e] dark:text-[#cbd5e1] dark:hover:bg-[#1d2f26] dark:hover:text-[#34d399]"
          title="Điều khoản dịch vụ"
        >
          <FileText className="h-3.5 w-3.5 text-[#5f6368] dark:text-[#94a3b8]" />
          <span>Điều khoản</span>
        </Link>

        <button
          type="button"
          onClick={onOpenUpcoming}
          className="flex h-8.5 w-8.5 items-center justify-center rounded-full border border-[#dadce0] bg-white text-xs font-medium text-[#3c4043] transition-colors hover:bg-[#f1f3f4] sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5 lg:px-3.5 dark:border-[#23382d] dark:bg-[#17241e] dark:text-[#f1f5f9] dark:hover:bg-[#1d2f26] dark:hover:text-[#34d399]"
          title="Xem lịch trình sắp tới"
          aria-label="Xem lịch trình sắp tới"
        >
          <Video className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#00897b] dark:text-[#2dd4bf]" />
          <span className="hidden lg:inline">Lịch trình</span>
        </button>

        {isAuthenticated && user ? (
          <div className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-[#dadce0] bg-[#f8fafd] py-0.5 pl-1 pr-1.5 sm:py-1 sm:pl-1.5 sm:pr-2 dark:border-[#23382d] dark:bg-[#17241e]">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.picture}
                alt={user.name}
                className="h-6.5 w-6.5 sm:h-7 sm:w-7 rounded-full object-cover ring-1 ring-white dark:ring-[#23382d]"
              />
            ) : (
              <div className="flex h-6.5 w-6.5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-[#1a73e8] text-[11px] sm:text-xs font-medium text-white dark:bg-[#059669]">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden max-w-[100px] truncate text-xs font-medium text-[#1f1f1f] md:inline dark:text-[#f1f5f9]">
              {user.name}
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#34a853] shrink-0 dark:text-[#10b981]" />
            <button
              type="button"
              onClick={onLogout}
              title="Đăng xuất"
              aria-label="Đăng xuất"
              className="ml-0.5 sm:ml-1 rounded-full p-1 text-[#5f6368] hover:bg-[#e8eaed] transition-colors dark:text-[#94a3b8] dark:hover:bg-[#1d2f26] dark:hover:text-[#f1f5f9]"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <a
            href="/api/auth/google"
            className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-[#1a73e8] px-2.5 py-1.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-[#1557b0] sm:px-4 dark:bg-[#059669] dark:hover:bg-[#047857]"
          >
            {/* Google G icon */}
            <svg className="h-4 w-4 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 24 24">
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
            <span className="hidden sm:inline">Kết nối Google</span>
            <span className="sm:hidden">Kết nối</span>
            {!isConfigured && (
              <span className="rounded-full bg-[#1557b0] px-1.5 py-0.2 text-[10px] text-blue-100 dark:bg-[#047857]">
                Mock
              </span>
            )}
          </a>
        )}
      </div>
    </header>
  );
}
