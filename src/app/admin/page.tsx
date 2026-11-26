import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { AdminModelSettings } from '@/components/AdminModelSettings';
import { PageHeader } from '@/components/PageHeader';
import { getAdminModelConfig } from '@/lib/ai/admin-config';
import { isAdminSession } from '@/lib/auth/admin';
import { getServerSession } from '@/lib/auth/server-session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trang Quản Trị Model AI — Calendai',
  description: 'Quản lý model AI chính và model dự phòng trên Calendai.',
};

export default async function AdminPage() {
  const session = await getServerSession();
  if (!isAdminSession(session)) {
    return (
      <div className="min-h-screen bg-[#f5eee1] text-[#2b1f17] transition-colors dark:bg-[#14110f] dark:text-[#f5ebd9]">
        <PageHeader currentPage="admin" />
        <main className="mx-auto flex max-w-2xl items-center justify-center px-4 py-16">
          <div className="w-full rounded-3xl border-2 border-[#2d2015] bg-[#fffaf2] p-8 text-center shadow-[4px_4px_0px_#2d2015] dark:border-[#453427] dark:bg-[#211a14] dark:shadow-[4px_4px_0px_#453427]">
            <ShieldAlert className="mx-auto h-10 w-10 text-[#cf3e32] dark:text-[#f87171]" />
            <h1 className="mt-4 text-2xl font-extrabold">403 — Không có quyền truy cập</h1>
            <p className="mt-2 text-sm text-[#786455] dark:text-[#ba9f88]">
              Trang quản trị chỉ dành cho tài khoản quản trị viên được cấu hình trên máy chủ.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-xl border-2 border-[#2d2015] bg-[#c25e2e] px-5 py-2.5 text-sm font-bold text-white shadow-[2px_2px_0px_#2d2015] hover:bg-[#a6491e] dark:border-[#453427] dark:bg-[#e07a3f] dark:text-[#14110f]"
            >
              Quay về trang chủ
            </Link>
          </div>
        </main>
      </div>
    );
  }

  let initialPrimaryModel = '';
  let initialFallbackModel: string | null = null;
  let initialUpdatedAt: string | undefined;
  let initialUpdatedBy: string | undefined;
  let envLoadError: string | undefined;

  try {
    const config = getAdminModelConfig();
    initialPrimaryModel = config.primaryModel;
    initialFallbackModel = config.fallbackModel;
    initialUpdatedAt = config.updatedAt;
    initialUpdatedBy = config.updatedBy;
  } catch {
    envLoadError = 'Máy chủ chưa cấu hình AI_API_KEY hoặc AI_MODEL đầy đủ.';
  }

  return (
    <div className="min-h-screen bg-[#f5eee1] text-[#2b1f17] transition-colors dark:bg-[#14110f] dark:text-[#f5ebd9]">
      <PageHeader currentPage="admin" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="rounded-3xl border-2 border-[#2d2015] bg-[#fffaf2] p-6 shadow-[4px_4px_0px_#2d2015] sm:p-10 dark:border-[#453427] dark:bg-[#211a14] dark:shadow-[4px_4px_0px_#453427]">
          <AdminModelSettings
            initialPrimaryModel={initialPrimaryModel}
            initialFallbackModel={initialFallbackModel}
            initialUpdatedAt={initialUpdatedAt}
            initialUpdatedBy={initialUpdatedBy}
            envLoadError={envLoadError}
          />
        </section>
      </main>
    </div>
  );
}
