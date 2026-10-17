import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, Mail, Shield, ShieldCheck, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

export const metadata: Metadata = {
  title: 'Chính Sách Quyền Riêng Tư (Privacy Policy) — Calendai',
  description: 'Chính sách bảo mật và quyền riêng tư khi sử dụng ứng dụng Calendai kết nối Google Calendar API.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f5eee1] text-[#2b1f17] transition-colors dark:bg-[#14110f] dark:text-[#f5ebd9] relative">
      <PageHeader currentPage="privacy" />

      <main className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <article className="rounded-3xl border-2 border-[#2d2015] bg-[#fffaf2] p-6 shadow-[4px_4px_0px_#2d2015] sm:p-10 md:p-12 transition-colors dark:border-[#453427] dark:bg-[#211a14] dark:shadow-[4px_4px_0px_#453427]">
          {/* Header Title Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#2d2015]/20 dark:border-[#453427] pb-6 sm:pb-8">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-[#2d2015] bg-[#ede4d5] text-[#c25e2e] shadow-[2px_2px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#e07a3f] dark:shadow-[2px_2px_0px_#453427]">
                <Shield className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2d2015]/30 bg-[#ede4d5]/70 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#c25e2e] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#e07a3f]">
                  <Sparkles className="h-2.5 w-2.5 text-[#d49439] dark:text-[#fbbf24]" />
                  Bảo Mật & Minh Bạch
                </div>
                <h1 className="mt-1 text-xl font-extrabold tracking-tight text-[#2b1f17] sm:text-2xl md:text-3xl dark:text-[#f5ebd9]">
                  Chính Sách Quyền Riêng Tư
                </h1>
              </div>
            </div>
            <div className="self-start sm:self-auto rounded-xl border-2 border-[#2d2015]/30 bg-[#ede4d5]/60 px-3 py-1.5 text-xs font-mono font-medium text-[#786455] dark:border-[#453427] dark:bg-[#2a221b]/60 dark:text-[#ba9f88]">
              Cập nhật: 09/10/2026
            </div>
          </div>

          {/* Policy Sections */}
          <section className="mt-8 space-y-8 text-sm leading-relaxed text-[#5a4638] dark:text-[#d5c3b2]">
            {/* 1. Giới thiệu */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b1f17] dark:text-[#f5ebd9] flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-xs font-bold text-[#c25e2e] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#e07a3f] dark:shadow-[1px_1px_0px_#453427]">
                  1
                </span>
                <span>Giới thiệu</span>
              </h2>
              <p className="mt-2.5 pl-8.5">
                Ứng dụng <strong className="font-bold text-[#2b1f17] dark:text-[#f5ebd9]">Calendai</strong> (&quot;chúng tôi&quot;) cam kết tôn trọng và bảo vệ quyền riêng tư của người dùng. Chính sách này giải thích cách chúng tôi thu thập, sử dụng, lưu trữ và bảo vệ thông tin khi bạn sử dụng dịch vụ Calendai để quản lý lịch trình Google Calendar và tạo liên kết Google Meet thông qua ngôn ngữ tự nhiên tiếng Việt.
              </p>
            </div>

            {/* 2. Dữ liệu chúng tôi thu thập qua Google API */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b1f17] dark:text-[#f5ebd9] flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-xs font-bold text-[#c25e2e] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#e07a3f] dark:shadow-[1px_1px_0px_#453427]">
                  2
                </span>
                <span>Dữ liệu chúng tôi thu thập qua Google API</span>
              </h2>
              <div className="mt-2.5 pl-8.5 space-y-2.5">
                <p>
                  Khi bạn kết nối tài khoản Google với Calendai, chúng tôi chỉ yêu cầu các quyền truy cập tối thiểu theo nguyên tắc ít đặc quyền nhất (Least Privilege):
                </p>
                <ul className="list-disc space-y-2 pl-5 marker:text-[#c25e2e] dark:marker:text-[#e07a3f]">
                  <li>
                    <strong className="text-[#2b1f17] dark:text-[#f5ebd9]">Thông tin hồ sơ cơ bản (Profile & Email)</strong>: Nhận diện người dùng (tên, email, ảnh đại diện) để hiển thị trạng thái đăng nhập.
                  </li>
                  <li>
                    <strong className="text-[#2b1f17] dark:text-[#f5ebd9]">Google Calendar API</strong> (
                    <code className="rounded-md border border-[#2d2015]/30 bg-[#ede4d5] px-1.5 py-0.5 text-xs font-mono font-semibold text-[#c25e2e] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#e07a3f]">
                      https://www.googleapis.com/auth/calendar.events
                    </code>
                    ): Chỉ được dùng để đọc danh sách sự kiện sắp tới và tạo mới sự kiện lịch kèm liên kết Google Meet khi có sự xác nhận trực tiếp từ bạn.
                  </li>
                </ul>
              </div>
            </div>

            {/* 3. Cách chúng tôi sử dụng dữ liệu */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b1f17] dark:text-[#f5ebd9] flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-xs font-bold text-[#c25e2e] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#e07a3f] dark:shadow-[1px_1px_0px_#453427]">
                  3
                </span>
                <span>Cách chúng tôi sử dụng dữ liệu</span>
              </h2>
              <div className="mt-2.5 pl-8.5 space-y-2">
                <p>Dữ liệu từ Google Calendar của bạn được sử dụng độc quyền cho các mục đích:</p>
                <ul className="list-disc space-y-1.5 pl-5 marker:text-[#c25e2e] dark:marker:text-[#e07a3f]">
                  <li>Hiển thị danh sách cuộc họp sắp tới trên giao diện Calendai khi bạn yêu cầu.</li>
                  <li>Tạo sự kiện lịch và tạo phòng họp Google Meet sau khi bạn nhấn nút &quot;Xác nhận tạo lịch&quot;.</li>
                  <li>Hỗ trợ phân tích câu lệnh đặt lịch bằng trí tuệ nhân tạo (AI) trong phiên làm việc.</li>
                </ul>
              </div>
            </div>

            {/* 4. Google Limited Use Callout Box */}
            <div className="rounded-2xl border-2 border-[#1f7560] bg-[#1f7560]/10 p-5 sm:p-6 shadow-[3px_3px_0px_#1f7560] dark:border-[#2dd4bf] dark:bg-[#2dd4bf]/10 dark:shadow-[3px_3px_0px_#2dd4bf]">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1f7560] bg-[#fffaf2] text-[#1f7560] shadow-[1px_1px_0px_#1f7560] dark:border-[#2dd4bf] dark:bg-[#181310] dark:text-[#2dd4bf] dark:shadow-[1px_1px_0px_#2dd4bf]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1f7560] dark:text-[#2dd4bf]">
                    4. Tuân thủ chính sách dữ liệu người dùng của Google (Google API Services User Data Policy)
                  </h2>
                  <p className="mt-2 text-sm text-[#2b1f17] dark:text-[#f5ebd9]">
                    Việc Calendai sử dụng và chuyển giao thông tin nhận được từ Google API cho bất kỳ ứng dụng nào khác sẽ tuân thủ nghiêm ngặt{' '}
                    <a
                      href="https://developers.google.com/terms/api-services-user-data-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold underline decoration-[#1f7560] hover:text-[#1f7560] dark:decoration-[#2dd4bf] dark:hover:text-[#2dd4bf]"
                    >
                      <span>Chính sách dữ liệu người dùng dịch vụ Google API</span>
                      <ExternalLink className="h-3 w-3 inline" />
                    </a>
                    , bao gồm các yêu cầu về <strong>Sử dụng có giới hạn (Limited Use requirements)</strong>:
                  </p>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[#2b1f17] dark:text-[#f5ebd9] marker:text-[#1f7560] dark:marker:text-[#2dd4bf]">
                    <li>Chúng tôi <strong className="text-[#c25e2e] dark:text-[#e07a3f]">KHÔNG</strong> bán hoặc chia sẻ dữ liệu Google của bạn cho bất kỳ bên thứ ba nào.</li>
                    <li>Chúng tôi <strong className="text-[#c25e2e] dark:text-[#e07a3f]">KHÔNG</strong> sử dụng hoặc chuyển giao dữ liệu Google Calendar của bạn để phục vụ quảng cáo.</li>
                    <li>Chúng tôi <strong className="text-[#c25e2e] dark:text-[#e07a3f]">KHÔNG</strong> sử dụng dữ liệu Google Calendar của bạn để huấn luyện bất kỳ mô hình AI hoặc học máy (Machine Learning) nào.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 5. Lưu trữ và Bảo mật dữ liệu */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b1f17] dark:text-[#f5ebd9] flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-xs font-bold text-[#c25e2e] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#e07a3f] dark:shadow-[1px_1px_0px_#453427]">
                  5
                </span>
                <span>Lưu trữ và Bảo mật dữ liệu</span>
              </h2>
              <div className="mt-2.5 pl-8.5 space-y-2">
                <p>
                  • <strong>Mã truy cập (Access Token & Refresh Token)</strong>: Được mã hóa bằng chuẩn mật mã JWE (AES-256-GCM) và lưu trữ trong cookie HTTP-Only an toàn phía máy chủ. Token không bao giờ được gửi về trình duyệt của người dùng hay đưa vào prompt của các mô hình AI.
                </p>
                <p>
                  • <strong>Phiên làm việc thời gian thực</strong>: Chúng tôi không lưu trữ nội dung chi tiết toàn bộ lịch của bạn vào cơ sở dữ liệu dài hạn; mọi truy vấn diễn ra theo thời gian thực (real-time) và chỉ tồn tại trong phiên làm việc.
                </p>
              </div>
            </div>

            {/* 6. Quyền kiểm soát và Xóa dữ liệu của bạn */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b1f17] dark:text-[#f5ebd9] flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-xs font-bold text-[#c25e2e] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#e07a3f] dark:shadow-[1px_1px_0px_#453427]">
                  6
                </span>
                <span>Quyền kiểm soát và Xóa dữ liệu của bạn</span>
              </h2>
              <div className="mt-2.5 pl-8.5 space-y-2">
                <p>Bạn có toàn quyền kiểm soát và hủy bỏ dữ liệu của mình bất kỳ lúc nào:</p>
                <ul className="list-disc space-y-1.5 pl-5 marker:text-[#c25e2e] dark:marker:text-[#e07a3f]">
                  <li>
                    Bấm nút <strong className="text-[#2b1f17] dark:text-[#f5ebd9]">&quot;Đăng xuất&quot;</strong> trên thanh điều hướng Calendai để xóa ngay lập tức phiên làm việc và mã token khỏi cookie trình duyệt.
                  </li>
                  <li>
                    Thu hồi quyền truy cập của Calendai bất cứ lúc nào tại trang quản lý tài khoản Google của bạn:{' '}
                    <a
                      href="https://myaccount.google.com/permissions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-[#c25e2e] hover:underline dark:text-[#e07a3f]"
                    >
                      <span>https://myaccount.google.com/permissions</span>
                      <ExternalLink className="h-3 w-3 inline" />
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* 7. Liên hệ hỗ trợ */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b1f17] dark:text-[#f5ebd9] flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d2015] bg-[#ede4d5] text-xs font-bold text-[#c25e2e] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#2a221b] dark:text-[#e07a3f] dark:shadow-[1px_1px_0px_#453427]">
                  7
                </span>
                <span>Liên hệ hỗ trợ</span>
              </h2>
              <p className="mt-2.5 pl-8.5">
                Nếu bạn có bất kỳ câu hỏi nào về chính sách quyền riêng tư này, vui lòng liên hệ nhà phát triển qua hòm thư điện tử:{' '}
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
              <Link href="/terms" className="hover:text-[#c25e2e] dark:hover:text-[#e07a3f] transition-colors">
                Điều khoản dịch vụ
              </Link>
              <span>•</span>
              <Link href="/privacy" className="hover:text-[#c25e2e] dark:hover:text-[#e07a3f] transition-colors font-bold text-[#c25e2e] dark:text-[#e07a3f]">
                Chính sách quyền riêng tư
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
