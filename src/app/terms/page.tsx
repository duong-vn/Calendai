import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Mail, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

export const metadata: Metadata = {
  title: 'Điều Khoản Dịch Vụ (Terms of Service) — Calendai',
  description: 'Điều khoản dịch vụ sử dụng ứng dụng trợ lý lịch trình AI Calendai.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f5eee1] text-[#2b1f17] transition-colors dark:bg-[#14110f] dark:text-[#f5ebd9] relative">
      <PageHeader currentPage="terms" />

      <main className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <article className="rounded-3xl border-2 border-[#2d2015] bg-[#fffaf2] p-6 shadow-[4px_4px_0px_#2d2015] sm:p-10 md:p-12 transition-colors dark:border-[#453427] dark:bg-[#211a14] dark:shadow-[4px_4px_0px_#453427]">
          {/* Header Title Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#2d2015]/20 dark:border-[#453427] pb-6 sm:pb-8">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-[#2d2015] bg-[#ede4d5] text-[#d49439] shadow-[2px_2px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#fbbf24] dark:shadow-[2px_2px_0px_#453427]">
                <FileText className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2d2015]/30 bg-[#ede4d5]/70 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#d49439] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#fbbf24]">
                  <Sparkles className="h-2.5 w-2.5" />
                  Quy Định & Thỏa Thuận
                </div>
                <h1 className="mt-1 text-xl font-extrabold tracking-tight text-[#2b1f17] sm:text-2xl md:text-3xl dark:text-[#f5ebd9]">
                  Điều Khoản Dịch Vụ
                </h1>
              </div>
            </div>
            <div className="self-start sm:self-auto rounded-xl border-2 border-[#2d2015]/30 bg-[#ede4d5]/60 px-3 py-1.5 text-xs font-mono font-medium text-[#786455] dark:border-[#453427] dark:bg-[#2a221b]/60 dark:text-[#ba9f88]">
              Cập nhật: 09/10/2026
            </div>
          </div>

          {/* Terms Sections */}
          <section className="mt-8 space-y-8 text-sm leading-relaxed text-[#5a4638] dark:text-[#d5c3b2]">
            {/* 1. Chấp thuận điều khoản */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b1f17] dark:text-[#f5ebd9] flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-xs font-bold text-[#d49439] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#fbbf24] dark:shadow-[1px_1px_0px_#453427]">
                  1
                </span>
                <span>Chấp thuận điều khoản</span>
              </h2>
              <p className="mt-2.5 pl-8.5">
                Bằng việc truy cập hoặc sử dụng ứng dụng <strong className="font-bold text-[#2b1f17] dark:text-[#f5ebd9]">Calendai</strong> (&quot;Dịch vụ&quot;), bạn đồng ý tuân thủ các Điều khoản dịch vụ này cùng Chính sách quyền riêng tư của chúng tôi. Nếu bạn không đồng ý với bất kỳ điều khoản nào, vui lòng ngừng sử dụng dịch vụ.
              </p>
            </div>

            {/* 2. Mô tả dịch vụ */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b1f17] dark:text-[#f5ebd9] flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-xs font-bold text-[#d49439] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#fbbf24] dark:shadow-[1px_1px_0px_#453427]">
                  2
                </span>
                <span>Mô tả dịch vụ</span>
              </h2>
              <p className="mt-2.5 pl-8.5">
                Calendai cung cấp công cụ trợ lý AI hỗ trợ người dùng phân tích văn bản tiếng Việt để lên lịch cuộc họp Google Calendar và tự động tạo phòng họp Google Meet. Dịch vụ luôn yêu cầu người dùng xác nhận thông tin trước khi thực hiện thao tác tạo lịch trên tài khoản Google theo cơ chế Human-in-the-Loop.
              </p>
            </div>

            {/* 3. Trách nhiệm người dùng */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b1f17] dark:text-[#f5ebd9] flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-xs font-bold text-[#d49439] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#fbbf24] dark:shadow-[1px_1px_0px_#453427]">
                  3
                </span>
                <span>Trách nhiệm người dùng</span>
              </h2>
              <ul className="mt-2.5 pl-8.5 list-disc space-y-2 marker:text-[#d49439] dark:marker:text-[#fbbf24]">
                <li>Bạn chịu trách nhiệm bảo mật tài khoản Google của mình và mọi hoạt động diễn ra từ tài khoản đó.</li>
                <li>Không sử dụng Dịch vụ cho bất kỳ mục đích bất hợp pháp, phát tán thư rác (spam) hoặc can thiệp vào hoạt động của hệ thống.</li>
                <li>Kiểm tra tính chính xác của các chi tiết cuộc họp trên thẻ xem trước trước khi bấm &quot;Xác nhận tạo lịch&quot;.</li>
              </ul>
            </div>

            {/* 4. Tuyên bố từ chối trách nhiệm */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b1f17] dark:text-[#f5ebd9] flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-xs font-bold text-[#d49439] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#fbbf24] dark:shadow-[1px_1px_0px_#453427]">
                  4
                </span>
                <span>Tuyên bố từ chối trách nhiệm</span>
              </h2>
              <p className="mt-2.5 pl-8.5">
                Dịch vụ được cung cấp trên cơ sở &quot;nguyên trạng&quot; (as is). Chúng tôi nỗ lực tối đa để đảm bảo độ chính xác và tính sẵn sàng của dịch vụ, tuy nhiên không đảm bảo rằng dịch vụ sẽ không bao giờ bị gián đoạn hoặc không có sai sót do sự cố mạng, dịch vụ bên thứ ba (như Google API hoặc nhà cung cấp mô hình AI).
              </p>
            </div>

            {/* 5. Thay đổi điều khoản */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b1f17] dark:text-[#f5ebd9] flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-xs font-bold text-[#d49439] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#fbbf24] dark:shadow-[1px_1px_0px_#453427]">
                  5
                </span>
                <span>Thay đổi điều khoản</span>
              </h2>
              <p className="mt-2.5 pl-8.5">
                Chúng tôi có quyền cập nhật các điều khoản này khi cần thiết. Việc bạn tiếp tục sử dụng Dịch vụ sau khi các thay đổi được đăng tải đồng nghĩa với việc bạn chấp thuận các thay đổi đó.
              </p>
            </div>

            {/* 6. Liên hệ */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b1f17] dark:text-[#f5ebd9] flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-xs font-bold text-[#d49439] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#fbbf24] dark:shadow-[1px_1px_0px_#453427]">
                  6
                </span>
                <span>Liên hệ</span>
              </h2>
              <p className="mt-2.5 pl-8.5">
                Mọi thắc mắc hoặc góp ý về Điều khoản dịch vụ vui lòng gửi về hòm thư điện tử:{' '}
                <a
                  href="mailto:isdon243@gmail.com"
                  className="inline-flex items-center gap-1 font-bold text-[#c25e2e] hover:underline dark:text-[#e07a3f]"
                >
                  <Mail className="h-3.5 w-3.5 inline" />
                  <span>isdon243@gmail.com</span>
                </a>
                .
              </p>
            </div>
          </section>

          {/* Footer Legal Stamp */}
          <footer className="mt-12 border-t-2 border-[#2d2015]/15 pt-6 text-center dark:border-[#453427]">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-[#786455] dark:text-[#ba9f88]">
              <Link href="/" className="hover:text-[#c25e2e] dark:hover:text-[#e07a3f] transition-colors font-bold">
                Trang chủ Calendai
              </Link>
              <span>•</span>
              <Link href="/privacy" className="hover:text-[#c25e2e] dark:hover:text-[#e07a3f] transition-colors">
                Chính sách quyền riêng tư
              </Link>
              <span>•</span>
              <Link href="/terms" className="hover:text-[#c25e2e] dark:hover:text-[#e07a3f] transition-colors font-bold text-[#c25e2e] dark:text-[#e07a3f]">
                Điều khoản dịch vụ
              </Link>
            </div>
            <p className="mt-3 text-[11px] font-mono text-[#786455]/80 dark:text-[#ba9f88]/80">
              ⚙️ Calendai Chrono-Engine • Bản quyền thuộc về Calendai
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
}
