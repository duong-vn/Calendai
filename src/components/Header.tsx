'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle2,
  FileText,
  Globe,
  LogOut,
  MessageSquare,
  Moon,
  MoreVertical,
  RotateCcw,
  Shield,
  Sparkles,
  Sun,
  Video,
  X,
} from 'lucide-react';
import type { UserProfile } from '@/lib/auth/types';
import { ModelSelector } from './ModelSelector';

interface HeaderProps {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isConfigured: boolean;
  selectedModel?: string;
  onSelectModel?: (modelId: string) => void;
  onOpenUpcoming: () => void;
  onOpenHistory?: () => void;
  onOpenTips?: () => void;
  onClearSession?: () => void;
  onLogout: () => void;
}

export function Header({
  user,
  isAuthenticated,
  isConfigured,
  selectedModel,
  onSelectModel,
  onOpenUpcoming,
  onOpenHistory,
  onOpenTips,
  onClearSession,
  onLogout,
}: HeaderProps) {
  const [isDark, setIsDark] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  // Close mobile menu on outside click or escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    }
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

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
    <header className="sticky top-0 z-30 relative flex h-14 sm:h-16 w-full shrink-0 items-center justify-between border-b-2 border-[#2d2015] bg-[#fffaf2]/95 px-3 sm:px-6 backdrop-blur-md transition-colors pt-[env(safe-area-inset-top,0px)] dark:border-[#453427] dark:bg-[#181310]/95">
      {/* Brand logo */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
          <div className="relative flex h-8.5 w-8.5 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-[#ede4d5] p-1 border-2 border-[#2d2015] shadow-[2px_2px_0px_#2d2015] group-hover:border-[#c25e2e] transition-all overflow-hidden shrink-0 dark:bg-[#211a14] dark:border-[#453427] dark:group-hover:border-[#e07a3f] dark:shadow-[2px_2px_0px_#453427]">
            <Image
              src="/assets/logo.png"
              alt="Calendai Logo"
              width={36}
              height={36}
              priority
              className="h-full w-full object-contain"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              id="header-app-name"
              className="text-base sm:text-lg font-bold tracking-tight text-[#2b1f17] dark:text-[#f5ebd9]"
            >
              Calendai
            </span>
            <span className="hidden rounded-full bg-[#f5eee1] px-2.5 py-0.5 text-[11px] font-bold text-[#c25e2e] sm:inline-flex items-center gap-1 border border-[#2d2015] dark:bg-[#211a14] dark:text-[#e07a3f] dark:border-[#453427]">
              <Sparkles className="h-3 w-3 text-[#d49439] dark:text-[#fbbf24]" />
              Trợ lý AI
            </span>
          </div>
        </Link>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Button: Lịch trình (Desktop / Tablet) */}
        <button
          type="button"
          onClick={onOpenUpcoming}
          className="hidden sm:flex h-9 w-9 min-h-[36px] min-w-[36px] touch-manipulation items-center justify-center rounded-full border-2 border-[#2d2015] bg-[#fffaf2] text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none sm:h-auto sm:w-auto sm:min-h-0 sm:min-w-0 sm:gap-1.5 sm:px-3 sm:py-1.5 lg:px-3.5 dark:border-[#23382d] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
          title="Xem lịch trình sắp tới"
          aria-label="Xem lịch trình sắp tới"
        >
          <Video className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#1f7560] dark:text-[#2dd4bf]" />
          <span className="hidden lg:inline">Lịch trình</span>
        </button>

        {/* Button: Lịch sử chat (Desktop / Tablet) */}
        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="hidden sm:flex h-9 w-9 min-h-[36px] min-w-[36px] touch-manipulation items-center justify-center rounded-full border-2 border-[#2d2015] bg-[#fffaf2] text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none sm:h-auto sm:w-auto sm:min-h-0 sm:min-w-0 sm:gap-1.5 sm:px-3 sm:py-1.5 dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
            title="Lịch sử các phiên chat"
            aria-label="Lịch sử các phiên chat"
          >
            <MessageSquare className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#c25e2e] dark:text-[#e07a3f]" />
            <span className="hidden lg:inline">Lịch sử</span>
          </button>
        )}

        {/* Button: Mẹo nâng cao (Desktop / Tablet) */}
        {onOpenTips && (
          <button
            type="button"
            onClick={onOpenTips}
            className="hidden md:flex h-9 w-9 min-h-[36px] min-w-[36px] touch-manipulation items-center justify-center rounded-full border-2 border-[#2d2015] bg-[#fffaf2] text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none sm:h-auto sm:w-auto sm:min-h-0 sm:min-w-0 sm:gap-1.5 sm:px-3 sm:py-1.5 dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
            title="Xem mẹo đặt lịch & các tham số nâng cao"
            aria-label="Xem mẹo đặt lịch"
          >
            <Sparkles className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#d49439] dark:text-[#fbbf24]" />
            <span className="hidden lg:inline">Mẹo</span>
          </button>
        )}

        {/* Buttons to Privacy and Terms (Desktop/Tablet only) */}
        <Link
          href="/privacy"
          className="hidden md:flex items-center gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-3 py-1.5 text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
          title="Chính sách quyền riêng tư"
        >
          <Shield className="h-3.5 w-3.5 text-[#c25e2e] dark:text-[#e07a3f]" />
          <span>Chính sách</span>
        </Link>

        <Link
          href="/terms"
          className="hidden md:flex items-center gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-3 py-1.5 text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
          title="Điều khoản dịch vụ"
        >
          <FileText className="h-3.5 w-3.5 text-[#786455] dark:text-[#ba9f88]" />
          <span>Điều khoản</span>
        </Link>

        {onClearSession && (
          <button
            type="button"
            onClick={onClearSession}
            className="hidden sm:flex h-9 w-9 min-h-[36px] min-w-[36px] touch-manipulation items-center justify-center rounded-full border-2 border-[#2d2015] bg-[#fffaf2] text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#fdf2f0] hover:text-[#cf3e32] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none sm:h-auto sm:w-auto sm:min-h-0 sm:min-w-0 sm:gap-1.5 sm:px-3 sm:py-1.5 dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2e1917] dark:hover:text-[#fca5a5]"
            title="Xóa session (Bắt đầu đoạn chat mới)"
            aria-label="Xóa session"
          >
            <RotateCcw className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#786455] dark:text-[#ba9f88]" />
            <span className="hidden lg:inline">Làm mới</span>
          </button>
        )}

        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-8.5 w-8.5 sm:h-9 sm:w-9 min-h-[34px] min-w-[34px] touch-manipulation items-center justify-center rounded-full border-2 border-[#2d2015] bg-[#fffaf2] text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus-visible:ring-2 focus-visible:ring-[#c25e2e] dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b] dark:focus-visible:ring-[#e07a3f]"
          title={isDark ? 'Chuyển sang giao diện Sáng' : 'Giao diện Tối'}
          aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Giao diện Tối'}
        >
          {isDark ? (
            <Sun className="h-4 w-4 text-[#fbbf24] hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="h-4 w-4 text-[#d49439] hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* User Profile / Connect Google Button */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-1 sm:gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#ede4d5] py-0.5 pl-1 pr-1.5 sm:py-1 sm:pl-1.5 sm:pr-2 shadow-[2px_2px_0px_#2d2015] dark:border-[#453427] dark:bg-[#211a14] dark:shadow-[2px_2px_0px_#453427]">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.picture}
                alt={user.name}
                className="h-6.5 w-6.5 sm:h-7 sm:w-7 rounded-full object-cover ring-1 ring-[#2d2015] dark:ring-[#453427]"
              />
            ) : (
              <div className="flex h-6.5 w-6.5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-[#c25e2e] text-[11px] sm:text-xs font-bold text-white dark:bg-[#e07a3f]">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden max-w-[100px] truncate text-xs font-bold text-[#2b1f17] md:inline dark:text-[#f5ebd9]">
              {user.name}
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#2d8a57] shrink-0 dark:text-[#34d399]" />
            <button
              type="button"
              onClick={onLogout}
              title="Đăng xuất"
              aria-label="Đăng xuất"
              className="ml-0.5 sm:ml-1 rounded-full p-1 text-[#786455] hover:bg-black/5 transition-colors dark:text-[#ba9f88] dark:hover:bg-white/10"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <a
            href="/api/auth/google"
            className="flex items-center gap-1 sm:gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#c25e2e] px-2.5 py-1 text-xs font-bold text-white shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#a6491e] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none sm:px-3.5 sm:py-1.5 dark:bg-[#e07a3f] dark:border-[#453427] dark:shadow-[2px_2px_0px_#453427] dark:text-[#14110f] dark:hover:bg-[#f59e0b]"
          >
            {/* Google G icon */}
            <svg className="h-4 w-4 bg-white rounded-full p-0.5 shrink-0 border border-[#2d2015]" viewBox="0 0 24 24">
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
              <span className="rounded-full bg-[#2d2015] px-1.5 py-0.2 text-[11px] text-amber-200">
                Mock
              </span>
            )}
          </a>
        )}

        {/* Mobile More Actions Menu (sm:hidden) */}
        <div ref={mobileMenuRef} className="relative sm:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-expanded={isMobileMenuOpen}
            aria-label="Menu tùy chọn"
            className="flex h-8.5 w-8.5 min-h-[34px] min-w-[34px] touch-manipulation items-center justify-center rounded-full border-2 border-[#2d2015] bg-[#fffaf2] text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
          >
            {isMobileMenuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </button>

          {isMobileMenuOpen && (
            <div
              role="menu"
              aria-label="Menu tùy chọn"
              className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-2xl border-2 border-[#2d2015] bg-[#fffaf2] p-2 shadow-[4px_4px_0px_#2d2015] backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-150 dark:border-[#453427] dark:bg-[#211a14] dark:shadow-[4px_4px_0px_#453427]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenUpcoming();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#2b1f17] hover:bg-[#ede4d5] transition-colors dark:text-[#f5ebd9] dark:hover:bg-[#2a221b]"
              >
                <Video className="h-4 w-4 text-[#1f7560] dark:text-[#2dd4bf]" />
                <span>Lịch trình sắp tới</span>
              </button>

              {onOpenHistory && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenHistory();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#2b1f17] hover:bg-[#ede4d5] transition-colors dark:text-[#f5ebd9] dark:hover:bg-[#2a221b]"
                >
                  <MessageSquare className="h-4 w-4 text-[#c25e2e] dark:text-[#e07a3f]" />
                  <span>Lịch sử phiên chat</span>
                </button>
              )}

              {onOpenTips && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenTips();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#2b1f17] hover:bg-[#ede4d5] transition-colors dark:text-[#f5ebd9] dark:hover:bg-[#2a221b]"
                >
                  <Sparkles className="h-4 w-4 text-[#d49439] dark:text-[#fbbf24]" />
                  <span>Mẹo nâng cao</span>
                </button>
              )}

              {onClearSession && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onClearSession();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#a63024] hover:bg-[#fdf2f0] transition-colors dark:text-[#fca5a5] dark:hover:bg-[#2b1111]"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Làm mới hội thoại</span>
                </button>
              )}

              <div className="my-1 border-t-2 border-[#2d2015]/30 dark:border-[#453427]" />

              <Link
                href="/privacy"
                role="menuitem"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#786455] hover:bg-[#ede4d5] transition-colors dark:text-[#ba9f88] dark:hover:bg-[#2a221b]"
              >
                <Shield className="h-4 w-4 text-[#c25e2e] dark:text-[#e07a3f]" />
                <span>Chính sách quyền riêng tư</span>
              </Link>

              <Link
                href="/terms"
                role="menuitem"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#786455] hover:bg-[#ede4d5] transition-colors dark:text-[#ba9f88] dark:hover:bg-[#2a221b]"
              >
                <FileText className="h-4 w-4 text-[#786455] dark:text-[#ba9f88]" />
                <span>Điều khoản dịch vụ</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
