# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Người dùng cá nhân, freelancer, sinh viên và nhân viên văn phòng tại Việt Nam thường xuyên sử dụng Google Calendar và Google Meet trong công việc hàng ngày, có nhu cầu lên lịch hẹn và tạo phòng họp trực tuyến nhanh chóng thông qua ngôn ngữ tự nhiên tiếng Việt thay vì thao tác thủ công qua nhiều bước giao diện.

## Product Purpose

Calendai ra đời để đơn giản hóa quy trình đặt lịch: chuyển đổi các câu nói, đoạn chat thông thường bằng tiếng Việt thành sự kiện Google Calendar chính xác, tự động tạo link Google Meet khi cần, và luôn bảo vệ dữ liệu người dùng bằng cơ chế duyệt xem trước an toàn (Human-in-the-loop).

## Positioning

Trợ lý AI tiếng Việt tối giản và trực diện: đặt lịch và tạo Google Meet siêu tốc qua một câu lệnh tự nhiên, giao diện thẻ xem trước rõ ràng, không lưu trữ token nhạy cảm ngoài luồng mã hóa JWE an toàn, chỉ ghi vào Google Calendar khi có sự đồng ý trực tiếp của người dùng.

## Operating Context

- Trình duyệt web trên máy tính để bàn, laptop và thiết bị di động (Mobile web responsive).
- Tích hợp sâu với hệ sinh thái Google (Google Workspace, Google Calendar v3, Google Meet).
- Môi trường làm việc và học tập tại Việt Nam, múi giờ mặc định `Asia/Ho_Chi_Minh` (GMT+7).

## Capabilities and Constraints

### Capabilities
- Xử lý ngôn ngữ tự nhiên tiếng Việt cho thời gian linh hoạt (ví dụ: "sáng mai 9h", "chiều thứ sáu tuần sau 14:30", "1 tiếng nữa").
- Tự động trích xuất tiêu đề, thời gian, mô tả và danh sách email khách mời.
- Tùy chọn tạo link Google Meet thông minh (chỉ tạo khi người dùng yêu cầu).
- Tra cứu danh sách lịch trình sắp tới từ Google Calendar.
- Thẻ xem trước `MeetingPreviewCard` cho phép chỉnh sửa hoặc bấm xác nhận trước khi tạo lịch thật.
- Giao diện hỗ trợ Dark Mode tinh chỉnh hài hòa và Light Mode thanh lịch.

### Constraints
- Tuân thủ nghiêm ngặt chính sách bảo mật Google OAuth 2.0 (không rò rỉ token, client secrets vào prompt LLM hoặc browser).
- Hỗ trợ linh hoạt các nhà cung cấp mô hình LLM theo chuẩn OpenAI API (`AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`).
- Phản hồi và trải nghiệm luôn ưu tiên tiếng Việt tự nhiên, lịch sự.

## Brand Commitments

- Tên sản phẩm: **Calendai**.
- Giọng văn: Thân thiện, tôn trọng, súc tích, phản hồi bằng tiếng Việt chuẩn mực.
- Thiết kế: Gọn gàng, chuẩn xác, hiện đại, kế thừa trải nghiệm quen thuộc của Google Workspace kết hợp điểm nhấn công nghệ AI.

## Evidence on Hand

- Logo & Favicon chính thức tại `public/assets/logo.png`.
- Chính sách quyền riêng tư (`/privacy`) và Điều khoản dịch vụ (`/terms`) chuẩn Google OAuth Verification.
- Bộ kiểm thử tự động Vitest bao phủ xác thực, dịch vụ Google Calendar và các thành phần UI cốt lõi.

## Product Principles

1. **Con người kiểm soát (Human-in-the-Loop)**: AI chỉ đề xuất và chuẩn bị sẵn, quyết định tạo lịch và gửi thư mời luôn thuộc về người dùng.
2. **Tiếng Việt tự nhiên & thông minh**: Hiểu trọn vẹn ngữ cảnh giao tiếp và cách diễn đạt thời gian của người Việt.
3. **Tối giản & Tức thì**: Không rườm rà, đưa người dùng từ suy nghĩ đến sự kiện trên lịch trong thời gian ngắn nhất.
4. **Bảo mật tuyệt đối**: Dữ liệu và quyền riêng tư của lịch làm việc được bảo vệ bằng mã hóa chuẩn công nghiệp.
