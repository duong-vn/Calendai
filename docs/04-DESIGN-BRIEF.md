# Design Brief — Calendai

## 1. Triết lý thiết kế (Design Philosophy)
Calendai được định hướng theo phong cách **Tối giản hiện đại (Modern Minimalist & Human-Centric)** kết hợp chuẩn mực **Productivity Tool**:
- **Trực quan & Đáng tin cậy**: Giao diện tạo cảm giác an tâm khi thao tác với lịch làm việc và tài khoản cá nhân.
- **Tập trung vào nội dung cuộc hội thoại (Content-first)**: Khung chat rộng rãi, tin nhắn rõ ràng, phân biệt rành mạch giữa lời thoại trợ lý, thông báo hệ thống và thẻ tương tác hành động (Actionable Cards).
- **Tối ưu hóa tiếng Việt (Vietnamese Typography First)**: Lựa chọn font chữ hỗ trợ dấu tiếng Việt hoàn hảo, không bị lỗi vỡ font hay nhảy dòng ở các ký tự có dấu thanh điệu phức tạp (ể, ễ, ậ, ồ, ợ,...).

## 2. Hệ màu sắc (Color Palette)

Hệ màu được xây dựng dựa trên sự kết hợp hài hòa giữa màu nhận diện thương hiệu công nghệ hiện đại và màu biểu tượng Google Calendar / Meet:

| Vai trò (Role) | Mã Hex | Tên màu / Ý nghĩa | Ứng dụng |
| :--- | :--- | :--- | :--- |
| **Primary (Chủ đạo)** | `#2563EB` (Blue 600) | Electric Royal Blue | Nút CTA chính, avatar trợ lý AI, liên kết chủ đạo |
| **Primary Hover** | `#1D4ED8` (Blue 700) | Deep Royal Blue | Trạng thái hover của nút chính |
| **Secondary (Meet Green)**| `#059669` (Emerald 600)| Google Meet Emerald | Điểm nhấn cho liên kết Google Meet, thẻ thành công |
| **Surface / Background**| `#F8FAFC` (Slate 50) | Crisp Light Slate | Nền toàn bộ trang web (Light theme) |
| **Card Surface** | `#FFFFFF` (White) | Pure White | Khung chat, thẻ xem trước, hộp thoại |
| **Border / Divider** | `#E2E8F0` (Slate 200) | Subtle Slate Border | Đường viền thẻ, phân cách tin nhắn |
| **Text Primary** | `#0F172A` (Slate 900) | Deep Navy Black | Tiêu đề, chữ chính, độ tương phản cao |
| **Text Secondary** | `#475569` (Slate 600) | Neutral Slate Gray | Nhãn phụ, mô tả, timestamp |
| **Accent / Warning** | `#D97706` (Amber 600) | Warm Amber | Cảnh báo thiếu thông tin, token cần xác thực |
| **Error / Destructive** | `#DC2626` (Red 600) | Clear Crimson Red | Báo lỗi tạo lịch, nút ngắt kết nối |

## 3. Kiểu chữ (Typography)

- **Font chữ chính**: `Inter` hoặc `Plus Jakarta Sans` kết hợp fallback tiêu chuẩn hệ thống (`system-ui, -apple-system, sans-serif`).
- **Khả năng hiển thị tiếng Việt**: Khử triệt để lỗi chân chữ và khoảng cách dấu không đều ở các dấu móc và dấu ngã.
- **Thang kích thước chữ (Type Scale)**:
  - Heading 1 (App Title): `text-xl font-bold tracking-tight` (20px / 24px)
  - Heading 2 (Card Title): `text-base font-semibold` (16px / 20px)
  - Body Text (Chat Message): `text-sm font-normal leading-relaxed` (14px / 22px)
  - Caption / Subtext (Time, Attendees): `text-xs font-medium text-slate-500` (12px / 16px)
  - Button Text: `text-sm font-semibold tracking-wide` (14px)

## 4. Bố cục & Responsive (Layout & Breakpoints)

### 4.1. Desktop (≥ 1024px)
- **Cấu trúc 2 cột linh hoạt hoặc 1 cột tập trung cao độ**:
  - Header trên cùng (Sticky, cao 64px): Logo Calendai, trạng thái kết nối Google, Avatar/Nút Đăng nhập, thông tin múi giờ hiện tại (`Asia/Ho_Chi_Minh`).
  - Khung nội dung chính (Căn giữa, tối đa `max-w-4xl`):
    - Khu vực tin nhắn cuộn tự do (Scrollable message history) với khoảng đệm thoải mái.
    - Thanh nhập liệu chat cố định ở đáy (Floating Input Bar) với các nút gửi nhanh, gợi ý prompt và chỉ báo trạng thái AI đang gõ.
  - Sidebar phụ (Drawer / Slide-out panel có thể thu gọn): Xem nhanh các cuộc họp sắp tới trên Google Calendar.

### 4.2. Mobile (< 768px)
- **Tối ưu 100% không gian màn hình dọc**:
  - Header thu gọn (cao 56px) hiển thị icon trạng thái và nút kết nối nhỏ gọn.
  - Danh sách tin nhắn co giãn toàn màn hình, padding cạnh 16px.
  - Thanh nhập tin nhắn cố định sát đáy màn hình (Bottom Fixed Sheet), bàn phím ảo hiển thị không làm che khuất tin nhắn gần nhất.
  - Các nút hành động trên Thẻ xem trước (Preview Card) xếp dọc dạng full-width để dễ dàng chạm bằng ngón tay cái.

## 5. Thiết kế các thành phần giao diện đặc thù (Key UI Components)

### 5.1. Khung tin nhắn hội thoại (Message Bubbles)
- **Tin nhắn người dùng (User Message)**:
  - Căn lề phải.
  - Nền màu xanh chủ đạo `bg-blue-600 text-white`.
  - Bo góc `rounded-2xl rounded-br-sm`.
- **Tin nhắn trợ lý (Assistant Message)**:
  - Căn lề trái, đi kèm avatar trợ lý Calendai nhỏ (`w-8 h-8 rounded-full bg-blue-100 text-blue-600`).
  - Nền màu trắng tinh tế `bg-white border border-slate-200 text-slate-900 shadow-sm`.
  - Bo góc `rounded-2xl rounded-bl-sm`.

### 5.2. Thẻ xem trước cuộc họp (Meeting Preview Card)
- **Thiết kế dạng Card tương tác nổi bật**:
  - Nền trắng `bg-white`, viền màu xanh nhạt `border-2 border-blue-200`, đổ bóng nhẹ `shadow-md`.
  - Icon lịch và nhãn nổi bật: *"XÁC NHẬN LỊCH HẸN"* với badge trạng thái màu xanh da trời.
  - Khối chi tiết:
    - 🕒 **Thời gian**: Khối highlight nền xám nhạt `bg-slate-50 p-3 rounded-lg`, hiển thị thứ, ngày, giờ bắt đầu - kết thúc rõ ràng.
    - 👥 **Người tham gia**: Danh sách avatar chữ viết tắt kèm badge email.
    - 📹 **Tùy chọn Meet**: Toggle icon Google Meet có chỉ báo *"Được bật: Tự động tạo link họp trực tuyến"*.
  - Nhóm nút bấm hành động (Action Buttons):
    - Nút chính: `bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow transition-all flex items-center justify-center gap-2`.
    - Nút phụ: `border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium py-2.5 px-4 rounded-xl transition-all`.

### 5.3. Thẻ kết quả thành công (Event Created Success Card)
- Nền xanh lục nhạt `bg-emerald-50 border border-emerald-200 rounded-2xl p-4`.
- Biểu tượng tích xanh tròn `CheckCircle2` động nhẹ.
- Hộp Google Meet link chuyên dụng:
  - Nền trắng `bg-white p-3 rounded-xl border border-emerald-150 flex items-center justify-between`.
  - Icon Google Meet dạng SVG chuẩn.
  - Text link: `meet.google.com/xxx-yyyy-zzz`.
  - Nút "Sao chép link" với tooltip phản hồi *"Đã sao chép!"*.
  - Nút "Tham gia ngay" mở trực tiếp tab Meet.
- Nút "Mở trong Google Calendar" mở link sự kiện thật.

### 5.4. Thẻ sự kiện sắp tới (Upcoming Events Item)
- Dạng danh sách thẻ nhỏ gọn (compact cards).
- Hiển thị ngày giờ dạng badge bên trái, tiêu đề ở giữa, nút Meet nhanh bên phải.

## 6. Trợ năng & Đảm bảo tiêu chuẩn (Accessibility - WCAG 2.1 AA)
- Độ tương phản chữ (Contrast Ratio): Mọi cặp chữ và nền đạt tối thiểu 4.5:1 (đối với văn bản thường) và 3:1 (đối với văn bản lớn).
- Hỗ trợ bàn phím (Keyboard Navigation): Toàn bộ các nút, thẻ xác nhận, input có `focus-visible:ring-2 focus-visible:ring-blue-500` rõ rệt.
- Trạng thái ARIA: Các nút tải có `aria-busy="true"`, các thông báo lỗi có `role="alert"`.
