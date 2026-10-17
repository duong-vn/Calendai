import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass, Home, Shield, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

export const metadata: Metadata = {
  title: '404 — Không Tìm Thấy Trang | Calendai',
  description: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển trên Calendai.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f5eee1] text-[#2b1f17] transition-colors dark:bg-[#14110f] dark:text-[#f5ebd9] relative flex flex-col">
      <PageHeader currentPage="not-found" />

      <main className="relative z-10 mx-auto max-w-2xl px-4 py-12 sm:py-20 flex-1 flex items-center justify-center">
        <div className="w-full text-center rounded-3xl border-2 border-[#2d2015] bg-[#fffaf2] p-8 shadow-[4px_4px_0px_#2d2015] sm:p-12 transition-colors dark:border-[#453427] dark:bg-[#211a14] dark:shadow-[4px_4px_0px_#453427]">
          {/* Compass Steam Badge */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-[#2d2015] bg-[#ede4d5] text-[#c25e2e] shadow-[3px_3px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#e07a3f] dark:shadow-[3px_3px_0px_#453427]">
            <Compass className="h-10 w-10 animate-[spin_20s_linear_infinite]" />
          </div>

          <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-[#2d2015]/30 bg-[#ede4d5]/70 px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider text-[#c25e2e] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#e07a3f]">
            <Sparkles className="h-3 w-3 text-[#d49439] dark:text-[#fbbf24]" />
            Lạc bước giữa dòng thời gian
          </div>

          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#2b1f17] sm:text-4xl dark:text-[#f5ebd9]">
            404 — Không Tìm Thấy Trang
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-[#786455] dark:text-[#ba9f88] max-w-md mx-auto">
            Bánh răng dẫn hướng dường như đã đưa bạn đến một tọa độ không tồn tại trong hệ thống Calendai. Vui lòng kiểm tra lại liên kết hoặc quay về xưởng điều khiển chính.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#2d2015] bg-[#c25e2e] px-6 py-2.5 text-sm font-bold text-white shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#a6491e] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#e07a3f] dark:text-[#14110f]"
            >
              <Home className="h-4 w-4" />
              <span>Về phòng làm việc chính</span>
            </Link>

            <Link
              href="/privacy"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#2d2015] bg-[#fffaf2] px-4 py-2.5 text-sm font-semibold text-[#2b1f17] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#f5ebd9] dark:shadow-[2px_2px_0px_#453427] dark:hover:bg-[#2a221b]"
            >
              <Shield className="h-4 w-4 text-[#c25e2e] dark:text-[#e07a3f]" />
              <span>Chính sách bảo mật</span>
            </Link>
          </div>

          <div className="mt-10 border-t-2 border-[#2d2015]/15 pt-5 text-[11px] font-mono text-[#786455] dark:text-[#ba9f88]">
            ⚙️ Calendai Chrono-Engine • Mã định danh lỗi: 404_PAGE_NOT_FOUND
          </div>
        </div>
      </main>
    </div>
  );
}
