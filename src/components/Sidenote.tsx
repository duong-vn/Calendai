'use client';

import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Info,
  MessageSquarePlus,
  Sparkles,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useState } from 'react';

const FULL_PROMPT_EXAMPLE =
  'Lên lịch cuộc họp "Review Dự Án Q4" vào 14:00 đến 15:30 chiều thứ Sáu tuần này, mời partner@company.com và dev@company.com, nội dung: Đánh giá tiến độ và phân công sprint mới, có link Google Meet nhé';

interface SidenoteProps {
  onUsePrompt: (prompt: string) => void;
  onClearChat?: () => void;
  hasMessages?: boolean;
  onClose?: () => void;
}

export function Sidenote({
  onUsePrompt,
  onClearChat,
  hasMessages,
  onClose,
}: SidenoteProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(FULL_PROMPT_EXAMPLE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="flex h-full flex-col space-y-5 text-sm text-[#2b1f17] dark:text-[#f5ebd9]">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[#2d2015]/20 dark:border-[#453427] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#2d2015] bg-[#ede4d5] text-[#c25e2e] shadow-[1px_1px_0px_#2d2015] dark:border-[#453427] dark:bg-[#211a14] dark:text-[#fbbf24]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-[#2b1f17] dark:text-[#f5ebd9]">Cẩm Nang Trợ Lý</h3>
            <p className="text-[11px] font-mono text-[#786455] dark:text-[#ba9f88]">Quy chuẩn lệnh & tham số</p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 min-h-[32px] min-w-[32px] touch-manipulation items-center justify-center rounded-full text-[#786455] hover:bg-[#ede4d5] transition-all active:scale-95 dark:text-[#ba9f88] dark:hover:bg-[#211a14]"
            title="Đóng bảng hướng dẫn"
            aria-label="Đóng bảng hướng dẫn"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* New chat action if messages exist */}
      {hasMessages && onClearChat && (
        <button
          type="button"
          onClick={onClearChat}
          className="flex min-h-[38px] touch-manipulation w-full items-center justify-center gap-2 rounded-xl border-2 border-[#2d2015] bg-[#fffaf2] py-2 px-3 text-xs font-bold text-[#c25e2e] shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#ede4d5] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#211a14] dark:text-[#e07a3f] dark:shadow-[2px_2px_0px_#453427]"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          <span>Bắt đầu cuộc trò chuyện mới</span>
        </button>
      )}

      {/* What AI can do */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[#786455] dark:text-[#ba9f88]">
          Cơ chế vận hành
        </span>
        <ul className="space-y-2 text-xs">
          <li className="flex items-start gap-2">
            <Calendar className="h-3.5 w-3.5 text-[#c25e2e] dark:text-[#e07a3f] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#2b1f17] dark:text-[#f5ebd9]">Lên lịch tự động</strong>: Tự suy luận ngày giờ tiếng Việt linh hoạt.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Users className="h-3.5 w-3.5 text-[#c25e2e] dark:text-[#e07a3f] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#2b1f17] dark:text-[#f5ebd9]">Trích xuất khách mời</strong>: Tự quét danh sách email trong câu nói.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Video className="h-3.5 w-3.5 text-[#1f7560] dark:text-[#2dd4bf] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#2b1f17] dark:text-[#f5ebd9]">Google Meet thông minh</strong>: Tạo link phòng họp khi có yêu cầu.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Clock className="h-3.5 w-3.5 text-[#c25e2e] dark:text-[#e07a3f] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#2b1f17] dark:text-[#f5ebd9]">Đồng hồ lịch trình</strong>: Tra cứu sự kiện sắp diễn ra trên Google Calendar.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#2d8a57] dark:text-[#34d399] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#2b1f17] dark:text-[#f5ebd9]">Đóng dấu xác nhận</strong>: Luôn hiển thị bản xem trước trước khi ghi lên lịch.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Cpu className="h-3.5 w-3.5 text-[#d49439] dark:text-[#fbbf24] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#2b1f17] dark:text-[#f5ebd9]">Đổi mô hình AI</strong>: Tùy biến bộ não AI theo sở thích của bạn.
            </span>
          </li>
        </ul>
      </div>

      {/* Supported Parameters */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#786455] dark:text-[#ba9f88]">
          Các tham số lệnh
        </span>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="rounded-xl border border-[#2d2015]/30 bg-[#f5eee1] p-2 dark:bg-[#16120f] dark:border-[#453427]">
            <span className="font-bold text-[#c25e2e] dark:text-[#e07a3f]">Tiêu đề:</span> Tên cuộc họp
          </div>
          <div className="rounded-xl border border-[#2d2015]/30 bg-[#f5eee1] p-2 dark:bg-[#16120f] dark:border-[#453427]">
            <span className="font-bold text-[#d49439] dark:text-[#fbbf24]">Thời gian:</span> Ngày & giờ bắt đầu
          </div>
          <div className="rounded-xl border border-[#2d2015]/30 bg-[#f5eee1] p-2 dark:bg-[#16120f] dark:border-[#453427]">
            <span className="font-bold text-[#2d8a57] dark:text-[#34d399]">Khách mời:</span> Email người tham gia
          </div>
          <div className="rounded-xl border border-[#2d2015]/30 bg-[#f5eee1] p-2 dark:bg-[#16120f] dark:border-[#453427]">
            <span className="font-bold text-[#2b1f17] dark:text-[#f5ebd9]">Mô tả:</span> Ghi chú cuộc họp
          </div>
          <div className="rounded-xl border border-[#2d2015]/30 bg-[#f5eee1] p-2 dark:bg-[#16120f] dark:border-[#453427]">
            <span className="font-bold text-[#1f7560] dark:text-[#2dd4bf]">Meet:</span> Bật/Tắt họp trực tuyến
          </div>
          <div className="rounded-xl border border-[#2d2015]/30 bg-[#f5eee1] p-2 dark:bg-[#16120f] dark:border-[#453427]">
            <span className="font-bold text-[#786455] dark:text-[#ba9f88]">Múi giờ:</span> GMT+7 (Hà Nội)
          </div>
        </div>
      </div>

      {/* Comprehensive Prompt Example */}
      <div className="rounded-2xl border-2 border-[#2d2015] bg-[#ede4d5] p-3.5 space-y-2.5 shadow-[3px_3px_0px_#2d2015] dark:border-[#453427] dark:bg-[#1f1813] dark:shadow-[3px_3px_0px_#453427]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#2b1f17] dark:text-[#f5ebd9]">
            <Info className="h-3.5 w-3.5 text-[#c25e2e] dark:text-[#e07a3f]" />
            <span>Ví dụ câu lệnh hoàn chỉnh</span>
          </div>
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="flex items-center gap-1 text-[11px] font-bold text-[#c25e2e] hover:underline dark:text-[#e07a3f]"
            title="Sao chép câu lệnh"
          >
            <Copy className="h-3 w-3" />
            <span>{copied ? 'Đã chép' : 'Chép'}</span>
          </button>
        </div>

        <p className="rounded-xl border-2 border-[#2d2015]/30 bg-[#fffaf2] p-2.5 text-xs text-[#2b1f17] leading-relaxed italic dark:bg-[#14110f] dark:text-[#f5ebd9] dark:border-[#453427]">
          &quot;{FULL_PROMPT_EXAMPLE}&quot;
        </p>

        <button
          type="button"
          onClick={() => onUsePrompt(FULL_PROMPT_EXAMPLE)}
          className="w-full min-h-[38px] touch-manipulation rounded-xl border-2 border-[#2d2015] bg-[#c25e2e] py-2 text-xs font-bold text-white shadow-[2px_2px_0px_#2d2015] transition-all hover:bg-[#a6491e] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:border-[#453427] dark:bg-[#e07a3f] dark:text-[#14110f]"
        >
          Dùng câu lệnh mẫu này
        </button>
      </div>

      {/* Footer legal links */}
      <div className="pt-2 border-t-2 border-[#2d2015]/20 dark:border-[#453427] flex items-center justify-center gap-2 text-[11px] text-[#786455] dark:text-[#ba9f88]">
        <Link
          href="/privacy"
          className="hover:text-[#c25e2e] dark:hover:text-[#e07a3f] transition-colors"
        >
          Chính sách quyền riêng tư
        </Link>
        <span>•</span>
        <Link
          href="/terms"
          className="hover:text-[#c25e2e] dark:hover:text-[#e07a3f] transition-colors"
        >
          Điều khoản dịch vụ
        </Link>
      </div>
    </div>
  );
}
