'use client';

import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
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
    <div className="flex h-full flex-col space-y-5 text-sm text-[#3c4043]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#f1f3f4] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e8f0fe] text-[#1a73e8]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-medium text-[#1f1f1f]">Khả Năng Của AI</h3>
            <p className="text-[11px] text-[#747775]">Hướng dẫn & tham số hỗ trợ</p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#5f6368] hover:bg-[#f1f3f4] transition-colors"
            title="Đóng bảng hướng dẫn"
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
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#dadce0] bg-white py-2 px-3 text-xs font-medium text-[#1a73e8] shadow-2xs transition-colors hover:bg-[#f8fafd]"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          <span>Bắt đầu cuộc trò chuyện mới</span>
        </button>
      )}

      {/* What AI can do */}
      <div className="space-y-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#747775]">
          Những gì AI có thể làm
        </span>
        <ul className="space-y-2 text-xs">
          <li className="flex items-start gap-2">
            <Calendar className="h-3.5 w-3.5 text-[#1a73e8] shrink-0 mt-0.5" />
            <span>
              <strong>Lên lịch thông minh</strong>: Tự suy luận ngày giờ tiếng Việt (sáng mai, chiều thứ 6 tuần tới, 30 phút nữa).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Users className="h-3.5 w-3.5 text-[#1a73e8] shrink-0 mt-0.5" />
            <span>
              <strong>Thêm khách mời</strong>: Tự trích xuất email mời tham gia sự kiện.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Video className="h-3.5 w-3.5 text-[#00897b] shrink-0 mt-0.5" />
            <span>
              <strong>Tùy chọn Google Meet</strong>: Chỉ tạo link Meet khi bạn yêu cầu (mặc định tắt nếu không nhắc đến Meet).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Clock className="h-3.5 w-3.5 text-[#1a73e8] shrink-0 mt-0.5" />
            <span>
              <strong>Tra cứu lịch trình</strong>: Xem các cuộc họp sắp tới trên Google Calendar.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#34a853] shrink-0 mt-0.5" />
            <span>
              <strong>Xác nhận an toàn</strong>: Luôn hiển thị bản xem trước để bạn xác nhận trước khi lưu lên Google.
            </span>
          </li>
        </ul>
      </div>

      {/* Supported Parameters */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#747775]">
          Các tham số khi tạo sự kiện
        </span>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="rounded-lg bg-[#f0f4f9] p-2">
            <span className="font-semibold text-[#1f1f1f]">Tiêu đề:</span> Tên/chủ đề cuộc họp
          </div>
          <div className="rounded-lg bg-[#f0f4f9] p-2">
            <span className="font-semibold text-[#1f1f1f]">Thời gian:</span> Ngày & giờ bắt đầu, kết thúc
          </div>
          <div className="rounded-lg bg-[#f0f4f9] p-2">
            <span className="font-semibold text-[#1f1f1f]">Khách mời:</span> Email người tham gia
          </div>
          <div className="rounded-lg bg-[#f0f4f9] p-2">
            <span className="font-semibold text-[#1f1f1f]">Mô tả:</span> Nội dung, ghi chú họp
          </div>
          <div className="rounded-lg bg-[#f0f4f9] p-2">
            <span className="font-semibold text-[#1f1f1f]">Google Meet:</span> Bật/Tắt họp online
          </div>
          <div className="rounded-lg bg-[#f0f4f9] p-2">
            <span className="font-semibold text-[#1f1f1f]">Múi giờ:</span> Mặc định GMT+7 (Hà Nội)
          </div>
        </div>
      </div>

      {/* Comprehensive Prompt Example */}
      <div className="rounded-2xl border border-[#dadce0] bg-[#f8fafd] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1f1f1f]">
            <Info className="h-3.5 w-3.5 text-[#1a73e8]" />
            <span>Ví dụ prompt đầy đủ tham số</span>
          </div>
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="flex items-center gap-1 text-[11px] font-medium text-[#1a73e8] hover:underline"
            title="Sao chép prompt"
          >
            <Copy className="h-3 w-3" />
            <span>{copied ? 'Đã chép' : 'Chép'}</span>
          </button>
        </div>

        <p className="rounded-xl bg-white p-2.5 text-xs text-[#1f1f1f] leading-relaxed border border-[#edf2fa] italic">
          &quot;{FULL_PROMPT_EXAMPLE}&quot;
        </p>

        <button
          type="button"
          onClick={() => onUsePrompt(FULL_PROMPT_EXAMPLE)}
          className="w-full rounded-xl bg-[#1a73e8] py-2 text-xs font-medium text-white shadow-2xs transition-colors hover:bg-[#1557b0]"
        >
          Dùng câu lệnh mẫu này
        </button>
      </div>

      {/* Footer legal links */}
      <div className="pt-2 border-t border-[#f1f3f4] flex items-center justify-center gap-2 text-[11px] text-[#747775]">
        <Link
          href="/privacy"
          className="hover:text-[#1a73e8] transition-colors"
        >
          Chính sách quyền riêng tư
        </Link>
        <span>•</span>
        <Link
          href="/terms"
          className="hover:text-[#1a73e8] transition-colors"
        >
          Điều khoản dịch vụ
        </Link>
      </div>
    </div>
  );
}
