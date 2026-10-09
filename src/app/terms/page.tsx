import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Calendar, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Điều Khoản Dịch Vụ (Terms of Service) — Calendai',
  description: 'Điều khoản dịch vụ sử dụng ứng dụng trợ lý lịch trình AI Calendai.',
};

export default function TermsPage() {
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logo.png"
              alt="Calendai Logo"
              className="h-7 w-7 object-contain rounded-lg"
            />
            <span className="font-semibold text-[#1f1f1f]">Calendai</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-3xl border border-[#dadce0] bg-white p-8 shadow-xs sm:p-12">
          <div className="flex items-center gap-3 text-[#1a73e8]">
            <FileText className="h-8 w-8" />
            <h1 className="text-2xl font-bold tracking-tight text-[#1f1f1f] sm:text-3xl">
              Điều Khoản Dịch Vụ (Terms of Service)
            </h1>
          </div>
          <p className="mt-2 text-xs text-[#5f6368]">
            Cập nhật lần cuối: Ngày 09 tháng 10 năm 2026
          </p>

          <hr className="my-6 border-[#e1e3e1]" />

          <section className="space-y-6 text-sm leading-relaxed text-[#3c4043]">
            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">1. Chấp thuận điều khoản</h2>
              <p className="mt-2">
                Bằng việc truy cập hoặc sử dụng ứng dụng <strong>Calendai</strong> (&quot;Dịch vụ&quot;), bạn đồng ý tuân thủ các Điều khoản dịch vụ này cùng Chính sách quyền riêng tư của chúng tôi. Nếu bạn không đồng ý với bất kỳ điều khoản nào, vui lòng ngừng sử dụng dịch vụ.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">2. Mô tả dịch vụ</h2>
              <p className="mt-2">
                Calendai cung cấp công cụ trợ lý AI hỗ trợ người dùng phân tích văn bản tiếng Việt để lên lịch cuộc họp Google Calendar và tự động tạo phòng họp Google Meet. Dịch vụ luôn yêu cầu người dùng xác nhận thông tin trước khi thực hiện thao tác tạo lịch trên tài khoản Google.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">3. Trách nhiệm người dùng</h2>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>Bạn chịu trách nhiệm bảo mật tài khoản Google của mình và mọi hoạt động diễn ra từ tài khoản đó.</li>
                <li>Không sử dụng Dịch vụ cho bất kỳ mục đích bất hợp pháp, phát tán thư rác (spam) hoặc can thiệp vào hoạt động của hệ thống.</li>
                <li>Kiểm tra tính chính xác của các chi tiết cuộc họp trước khi bấm &quot;Xác nhận tạo lịch&quot;.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">4. Tuyên bố từ chối trách nhiệm</h2>
              <p className="mt-2">
                Dịch vụ được cung cấp trên cơ sở &quot;nguyên trạng&quot; (as is). Chúng tôi nỗ lực tối đa để đảm bảo độ chính xác và tính sẵn sàng của dịch vụ, tuy nhiên không đảm bảo rằng dịch vụ sẽ không bao giờ bị gián đoạn hoặc không có lỗi do sự cố mạng hay sự cố từ dịch vụ của bên thứ ba (như Google API hoặc OpenRouter).
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">5. Thay đổi điều khoản</h2>
              <p className="mt-2">
                Chúng tôi có quyền cập nhật các điều khoản này khi cần thiết. Việc bạn tiếp tục sử dụng Dịch vụ sau khi các thay đổi được đăng tải đồng nghĩa với việc bạn chấp thuận các thay đổi đó.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">6. Liên hệ</h2>
              <p className="mt-2">
                Mọi thắc mắc về Điều khoản dịch vụ vui lòng gửi về email:{' '}
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
