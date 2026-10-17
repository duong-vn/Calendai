'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, FileText, Shield, Sparkles } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface PageHeaderProps {
  currentPage?: 'privacy' | 'terms' | 'not-found';
}

export function PageHeader({ currentPage }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 w-full shrink-0 items-center justify-between border-b-2 border-[#2d2015] bg-[#fffaf2]/95 px-3 sm:px-6 backdrop-blur-md transition-colors pt-[env(safe-area-inset-top,0px)] dark:border-[#453427] dark:bg-[#181310]/95">
      {/* Left: Back Link */}
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-2.5 sm:px-3 py-1.5 text-xs font-bold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
          title="Quay lại giao diện chính Calendai"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-[#c25e2e] dark:text-[#e07a3f]" />
          <span className="hidden sm:inline">Quay lại</span>
          <span>Calendai</span>
        </Link>
      </div>

      {/* Center: Brand Logo */}
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
          <span className="text-base sm:text-lg font-bold tracking-tight text-[#2b1f17] dark:text-[#f5ebd9]">
            Calendai
          </span>
          <span className="hidden rounded-full bg-[#f5eee1] px-2.5 py-0.5 text-[11px] font-bold text-[#c25e2e] md:inline-flex items-center gap-1 border border-[#2d2015] dark:bg-[#211a14] dark:text-[#e07a3f] dark:border-[#453427]">
            <Sparkles className="h-3 w-3 text-[#d49439] dark:text-[#fbbf24]" />
            Trợ lý AI
          </span>
        </div>
      </Link>

      {/* Right: Counterpart link & Theme Toggle */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {currentPage === 'privacy' && (
          <Link
            href="/terms"
            className="hidden sm:flex items-center gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-3 py-1.5 text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
            title="Điều khoản dịch vụ"
          >
            <FileText className="h-3.5 w-3.5 text-[#786455] dark:text-[#ba9f88]" />
            <span>Điều khoản</span>
          </Link>
        )}

        {currentPage === 'terms' && (
          <Link
            href="/privacy"
            className="hidden sm:flex items-center gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-3 py-1.5 text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
            title="Chính sách quyền riêng tư"
          >
            <Shield className="h-3.5 w-3.5 text-[#c25e2e] dark:text-[#e07a3f]" />
            <span>Chính sách</span>
          </Link>
        )}

        {currentPage === 'not-found' && (
          <>
            <Link
              href="/privacy"
              className="hidden sm:flex items-center gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-3 py-1.5 text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
            >
              <Shield className="h-3.5 w-3.5 text-[#c25e2e] dark:text-[#e07a3f]" />
              <span>Chính sách</span>
            </Link>
            <Link
              href="/terms"
              className="hidden sm:flex items-center gap-1.5 rounded-full border-2 border-[#2d2015] bg-[#fffaf2] px-3 py-1.5 text-xs font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
            >
              <FileText className="h-3.5 w-3.5 text-[#786455] dark:text-[#ba9f88]" />
              <span>Điều khoản</span>
            </Link>
          </>
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}
