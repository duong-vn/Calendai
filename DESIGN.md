---
name: Calendai
description: Trợ lý AI tiếng Việt đặt lịch Google Calendar & Google Meet trực diện, an toàn
colors:
  primary: "#1a73e8"
  primary-dark: "#10b981"
  primary-hover: "#1557b0"
  primary-dark-hover: "#047857"
  surface-light: "#ffffff"
  surface-dark: "#16221d"
  bg-light: "#f8fafd"
  bg-dark: "#101714"
  text-light: "#1f1f1f"
  text-dark: "#f1f5f9"
  text-muted-light: "#5f6368"
  text-muted-dark: "#94a3b8"
  border-light: "#dadce0"
  border-dark: "#23382d"
  accent-meet: "#00897b"
  accent-meet-dark: "#2dd4bf"
  accent-gold: "#fbbc04"
  accent-gold-dark: "#fbbf24"
  status-success: "#34a853"
  status-error: "#ea4335"
typography:
  display:
    fontFamily: '"Google Sans", "Plus Jakarta Sans", "Roboto", sans-serif'
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"Google Sans", "Plus Jakarta Sans", "Roboto", sans-serif'
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: '"Google Sans", "Plus Jakarta Sans", "Roboto", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  label:
    fontFamily: '"Google Sans", "Plus Jakarta Sans", "Roboto", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
  caption:
    fontFamily: '"Google Sans", "Plus Jakarta Sans", "Roboto", sans-serif'
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
---

# Design System: Calendai

## Overview

**Creative North Star: "Workspace AI Atelier"**

Calendai hòa quyện sự chuẩn mực, tin cậy của ngôn ngữ thiết kế Google Workspace cùng sự tinh tế, mượt mà của một xưởng trợ lý AI cá nhân cao cấp. Không khí giao diện tập trung vào sự ngăn nắp, thư thái và minh bạch, giúp người dùng biến các ý niệm thời gian rời rạc thành lịch trình chuẩn xác trong chớp mắt.

Hệ thống hỗ trợ song song hai chế độ hiển thị: Light Mode thanh thoát với tông nền Clean Paper (`#f8fafd`) mang đậm tinh thần văn phòng hiện đại; Dark Mode tinh tế với tông nền Slate Charcoal ánh xanh rêu trầm (`#101714` / `#16221d`) điểm xuyết sắc lục bảo Emerald (`#10b981`) và ánh vàng kim (`#fbbf24`), mang lại chiều sâu dịu mắt khi làm việc buổi tối.

**Key Characteristics:**
- **Mềm mại & Chính xác (Soft Pill Precision)**: Các nút bấm, nhãn trạng thái và ô nhập liệu dạng viên thuốc bo tròn (pill), kết hợp viền mảnh tinh gọn tạo cảm giác thân thiện nhưng chuẩn xác.
- **Minh bạch tương tác (Human-in-the-Loop)**: Mọi thao tác tác động vào lịch trình đều được trực quan hóa qua thẻ xem trước trước khi thực thi.
- **Thích ứng màn hình di động hoàn hảo**: Khóa chiều cao theo dynamic viewport (`dvh`), chống trôi bàn phím và tự động co giãn ô gõ thông minh.

## Colors

Bảng màu phân cấp theo chức năng Workspace rõ rệt, kết hợp sắc độ dịu êm chống chói.

### Primary
- **Google Electric Blue (Light)** (`#1a73e8`): Điểm nhấn hành động chính, nút gửi, liên kết và biểu tượng AI ở giao diện ban ngày.
- **Arcane Emerald Green (Dark)** (`#10b981`): Điểm nhấn chính ở giao diện ban đêm, tạo năng lượng tập trung và bảo vệ mắt.

### Secondary
- **Google Meet Teal** (`#00897b` / `#2dd4bf`): Dành riêng cho nhận diện phòng họp video Google Meet và nút tham gia họp.
- **Warm Gold** (`#fbbc04` / `#fbbf24`): Điểm xuyết cho các mẹo gợi ý, trạng thái chờ xác nhận và biểu tượng tia sáng trợ lý.

### Neutral
- **Clean Background (Light)** (`#f8fafd`): Nền không gian làm việc ban ngày.
- **Slate Obsidian (Dark)** (`#101714`): Nền không gian làm việc ban đêm.
- **Surface Elevation** (`#ffffff` / `#16221d`): Bề mặt thẻ tin nhắn, ô nhập lệnh và thanh điều hướng.
- **Divider & Outline** (`#dadce0` / `#23382d`): Viền phân cách mảnh nhẹ định hình cấu trúc khối.

### Named Rules
**The Single Accent Rule.** Mỗi màn hình hoặc thẻ chỉ có duy nhất một màu hành động nổi bật (Primary Blue hoặc Emerald Green). Màu Meet Teal và Gold chỉ mang tính chất định danh trạng thái, không cạnh tranh vùng chú ý của nút chính.

## Typography

**Display Font:** "Google Sans", "Plus Jakarta Sans", "Roboto", sans-serif  
**Body Font:** "Google Sans", "Plus Jakarta Sans", "Roboto", sans-serif  
**Label/Mono Font:** ui-monospace, SFMono-Regular, Menlo, Monaco, monospace  

**Character:** Hiện đại, dễ đọc lướt ở mọi kích cỡ màn hình, tối ưu hiển thị dấu thanh tiếng Việt trơn tru.

### Hierarchy
- **Display** (Medium 500, clamp(1.875rem, 4vw, 2.25rem), 1.2): Dùng cho tiêu đề chào mừng Hero ("Calendai").
- **Headline** (Medium 500, 1.25rem, 1.3): Tiêu đề popup modal, chính sách, điều khoản.
- **Title** (Medium 500, 1rem, 1.4): Tiêu đề sự kiện trong thẻ xem trước, tên danh mục.
- **Body** (Regular 400, 0.875rem (14px), 1.5, max line 70ch): Nội dung tin nhắn hội thoại, mô tả cuộc họp.
- **Label** (Medium 500, 0.75rem (12px), 1.4): Nhãn trạng thái, chip múi giờ, footer bản quyền.
- **Caption** (Medium 500, 0.6875rem (11px) / 0.625rem (10px), 1.4): Dùng cho badge Mock/Status, nhãn phụ, footer bản quyền.

## Layout

- **Viewport Lock**: Giao diện ứng dụng khóa cố định theo `100dvh` trên mobile, ngăn chặn triệt để hiện tượng cuộn giật toàn trang.
- **Trục hội thoại trung tâm**: Khung chat giới hạn bề ngang tối đa `max-w-3xl` căn giữa màn hình, giữ cự ly mắt đọc thoải mái.
- **Bong bóng tin nhắn tự co giãn**: Kích thước tin nhắn ôm sát nội dung (`w-fit`), giới hạn tối đa `max-w-[78%]` trên desktop và `max-w-[85%]` trên mobile, chống tràn dòng ngang.

## Elevation & Depth

Giao diện áp dụng triết lý phẳng có phân tầng nhẹ (Tonal Layering), hạn chế đổ bóng đậm.

### Shadow Vocabulary
- **Subtle Rest (`shadow-2xs`)**: `0 1px 2px rgba(0, 0, 0, 0.04)` - Dùng cho các thẻ chip và bong bóng tin nhắn.
- **Interactive Hover (`shadow-xs`)**: `0 1px 3px rgba(0, 0, 0, 0.08)` - Phản hồi khi di chuột lên nút bấm hoặc thẻ gợi ý prompt.
- **Elevated Modal (`shadow-2xl`)**: `0 25px 50px -12px rgba(0, 0, 0, 0.25)` - Phân tầng nổi cho Drawer Lịch trình và Mẹo nâng cao.

## Shapes

- **Pill Form (Nút & Chip)**: Bo tròn tuyệt đối (`rounded-full`) cho toàn bộ nút thao tác, chip múi giờ, thanh gửi lệnh và avatar.
- **Soft Geometry (Thẻ & Khung)**: Bo góc lớn `rounded-2xl` (16px) cho thẻ tin nhắn, thẻ xem trước sự kiện, và `rounded-3xl` (24px) cho modal hộp thoại.
- **Viền 1px tinh xảo**: Luôn có đường viền 1px (`border border-[#dadce0]` hoặc `dark:border-[#23382d]`) để định hình ranh giới khối rành mạch ngay cả trên màn hình độ sáng thấp.

## Components

### Buttons
- **Shape:** Viên thuốc bo tròn hoàn toàn (`rounded-full`).
- **Primary:** Nền xanh `bg-[#1a73e8]` (Dark: `bg-[#059669]`), chữ trắng, padding `px-4 py-2 text-xs sm:text-sm font-medium`.
- **Secondary / Pill Chip:** Nền trắng `bg-white` (Dark: `bg-[#17241e]`), viền `#dadce0` (Dark: `#23382d`), chữ `#3c4043` (Dark: `#cbd5e1`).
- **Hover:** Chuyển màu êm dịu `transition-colors`, không giật phóng to thu nhỏ.

### Chat Input Box
- **Shape:** Bo góc tròn lớn `rounded-3xl` với viền `#dadce0` (Dark: `#23382d`).
- **Textarea Behavior:** Tự động mở rộng chiều cao từ 1 dòng lên tối đa 140px (`max-h-36`) khi nội dung dài, phím Enter gửi tin, Shift+Enter xuống dòng.

### MeetingPreviewCard (Thẻ xem trước sự kiện)
- **Shape:** Bo góc `rounded-2xl` với dải banner nhận diện Google Calendar trên đầu.
- **Cấu trúc:** Vạch màu chỉ thị thời gian bên trái, thông tin chi tiết thời lượng, múi giờ và email khách mời.
- **Trạng thái Meet:** Nút toggle bật/tắt link Google Meet với màu sắc trạng thái xanh lá minh bạch.

## Do's and Don'ts

### Do:
- **Do** luôn bọc tin nhắn trong cấu trúc `w-fit max-w-[78%]` kèm `break-words`.
- **Do** giữ các nút bấm ở dạng pill bo tròn hoàn toàn (`rounded-full`).
- **Do** đảm bảo mọi phần tử tương tác đều hỗ trợ đầy đủ cả lớp Light Mode và Dark Mode (`dark:`).
- **Do** ưu tiên độ tương phản chữ rõ nét trên nền Dark Mode (dùng tông `#f1f5f9` / `#cbd5e1`, không dùng chữ quá tối trên nền tối).

### Don't:
- **Don't** tự ý tạo cuộc họp Google Calendar khi người dùng chưa nhấn nút xác nhận trên `MeetingPreviewCard`.
- **Don't** dùng viền bo góc sắc nhọn (`rounded-none` hoặc `rounded-xs`) cho các thành phần chính.
- **Don't** sử dụng hiệu ứng đổ bóng đen đậm gắt hoặc bóng neon quá mức gây mất tập trung.
