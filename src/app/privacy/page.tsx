import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Calendar, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Chính Sách Quyền Riêng Tư (Privacy Policy) — Calendai',
  description: 'Chính sách bảo mật và quyền riêng tư khi sử dụng ứng dụng Calendai kết nối Google Calendar API.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f8fafd] text-[#1f1f1f]">
      <header className="sticky top-0 z-10 border-b border-[#dadce0] bg-white/90 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-[#1a73e8] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Calendai</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-[#f0f4f9] text-[#1a73e8]">
              <Calendar className="h-4 w-4 text-[#1a73e8]" />
              <div className="absolute -bottom-0.5 -right-0.5 flex gap-0.5 rounded-full bg-white p-0.5 shadow-xs">
                <span className="h-1 w-1 rounded-full bg-[#4285f4]" />
                <span className="h-1 w-1 rounded-full bg-[#ea4335]" />
                <span className="h-1 w-1 rounded-full bg-[#fbbc04]" />
                <span className="h-1 w-1 rounded-full bg-[#34a853]" />
              </div>
            </div>
            <span className="font-semibold text-[#1f1f1f]">Calendai</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-3xl border border-[#dadce0] bg-white p-8 shadow-xs sm:p-12">
          <div className="flex items-center gap-3 text-[#1a73e8]">
            <Shield className="h-8 w-8" />
            <h1 className="text-2xl font-bold tracking-tight text-[#1f1f1f] sm:text-3xl">
              Chính Sách Quyền Riêng Tư (Privacy Policy)
            </h1>
          </div>
          <p className="mt-2 text-xs text-[#5f6368]">
            Cập nhật lần cuối: Ngày 09 tháng 10 năm 2026
          </p>

          <hr className="my-6 border-[#e1e3e1]" />

          <section className="space-y-6 text-sm leading-relaxed text-[#3c4043]">
            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">1. Giới thiệu</h2>
              <p className="mt-2">
                Ứng dụng <strong>Calendai</strong> (&quot;chúng tôi&quot;) cam kết tôn trọng và bảo vệ quyền riêng tư của người dùng. Chính sách này giải thích cách chúng tôi thu thập, sử dụng, lưu trữ và bảo vệ thông tin khi bạn sử dụng dịch vụ Calendai để quản lý lịch trình Google Calendar và tạo liên kết Google Meet.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">2. Dữ liệu chúng tôi thu thập qua Google API</h2>
              <p className="mt-2">
                Khi bạn kết nối tài khoản Google với Calendai, chúng tôi chỉ yêu cầu các quyền truy cập tối thiểu theo nguyên tắc ít đặc quyền nhất (Least Privilege):
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong>Thông tin hồ sơ cơ bản (Profile & Email)</strong>: Nhận diện người dùng (tên, email, ảnh đại diện) để hiển thị trạng thái đăng nhập.
                </li>
                <li>
                  <strong>Google Calendar API (<code className="rounded bg-[#f0f4f9] px-1 py-0.5 text-xs text-[#1a73e8]">https://www.googleapis.com/auth/calendar.events</code>)</strong>:
                  Chỉ được dùng để đọc danh sách sự kiện sắp tới và tạo mới sự kiện lịch kèm liên kết Google Meet khi có sự xác nhận trực tiếp từ bạn.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">3. Cách chúng tôi sử dụng dữ liệu</h2>
              <p className="mt-2">Dữ liệu từ Google Calendar của bạn được sử dụng độc quyền cho các mục đích:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>Hiển thị danh sách cuộc họp sắp tới trên giao diện Calendai khi bạn yêu cầu.</li>
                <li>Tạo sự kiện lịch và tạo phòng họp Google Meet sau khi bạn nhấn nút &quot;Xác nhận tạo lịch&quot;.</li>
                <li>Hỗ trợ phân tích câu lệnh đặt lịch bằng trí tuệ nhân tạo (AI) trong phiên làm việc.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[#ceead6] bg-[#e6f4ea]/50 p-4">
              <h2 className="text-base font-semibold text-[#137333]">
                4. Tuân thủ chính sách dữ liệu người dùng của Google (Google API Services User Data Policy)
              </h2>
              <p className="mt-2 text-[#137333]">
                Việc Calendai sử dụng và chuyển giao thông tin nhận được từ Google API cho bất kỳ ứng dụng nào khác sẽ tuân thủ nghiêm ngặt{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline hover:text-[#0b8043]"
                >
                  Chính sách dữ liệu người dùng dịch vụ Google API
                </a>
                , bao gồm các yêu cầu về <strong>Sử dụng có giới hạn (Limited Use requirements)</strong>:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-[#137333]">
                <li>Chúng tôi <strong>KHÔNG</strong> bán hoặc chia sẻ dữ liệu Google của bạn cho bất kỳ bên thứ ba nào.</li>
                <li>Chúng tôi <strong>KHÔNG</strong> sử dụng hoặc chuyển giao dữ liệu Google Calendar của bạn để phục vụ quảng cáo.</li>
                <li>Chúng tôi <strong>KHÔNG</strong> sử dụng dữ liệu Google Calendar của bạn để huấn luyện bất kỳ mô hình AI hoặc học máy (Machine Learning) nào.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">5. Lưu trữ và Bảo mật dữ liệu</h2>
              <p className="mt-2">
                - Mã truy cập (Access Token & Refresh Token) được mã hóa bằng chuẩn mật mã JWE (AES-256-GCM) và lưu trữ trong cookie HTTP-Only an toàn phía máy chủ. Token không bao giờ được gửi về trình duyệt của người dùng hay đưa vào prompt AI.
                <br />
                - Chúng tôi không lưu trữ nội dung chi tiết toàn bộ lịch của bạn vào cơ sở dữ liệu dài hạn; mọi truy vấn diễn ra theo thời gian thực (real-time) và chỉ tồn tại trong phiên làm việc.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">6. Quyền kiểm soát và Xóa dữ liệu của bạn</h2>
              <p className="mt-2">
                Bạn có toàn quyền kiểm soát dữ liệu của mình:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>Bấm nút &quot;Đăng xuất&quot; trên thanh điều hướng Calendai để xóa ngay lập tức phiên làm việc và mã token khỏi cookie trình duyệt.</li>
                <li>Thu hồi quyền truy cập của Calendai bất cứ lúc nào tại trang quản lý tài khoản Google của bạn:{' '}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1a73e8] hover:underline"
                  >
                    https://myaccount.google.com/permissions
                  </a>.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">7. Liên hệ hỗ trợ</h2>
              <p className="mt-2">
                Nếu bạn có bất kỳ câu hỏi nào về chính sách quyền riêng tư này, vui lòng liên hệ nhà phát triển qua email:{' '}
                <a href="mailto:isdon243@gmail.com" className="font-semibold text-[#1a73e8] hover:underline">
                  isdon243@gmail.com
                </a>.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
