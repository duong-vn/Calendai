# Product Requirements Document (PRD) — Calendai

## 1. Tổng quan sản phẩm (Product Overview)
**Calendai** là ứng dụng web trợ lý lịch trình AI (AI Calendar Assistant) ưu tiên tiếng Việt (Vietnamese-first), cho phép người dùng lên lịch cuộc họp Google Calendar tự động kèm liên kết Google Meet thông qua giao diện hội thoại ngôn ngữ tự nhiên. Ứng dụng hướng đến trải nghiệm mượt mà, trực quan, bảo mật cao và luôn yêu cầu người dùng xác nhận trước khi tạo sự kiện thực tế trên Google Calendar.

## 2. Mục tiêu sản phẩm (Product Goals)
- **Hội thoại tự nhiên bằng tiếng Việt**: Hiểu và xử lý các câu lệnh đặt lịch tiếng Việt đa dạng (ví dụ: "Đặt lịch họp với anh Nam lúc 9h sáng mai bàn về dự án", "Lên lịch review code chiều thứ 6 tuần này từ 14:00 đến 15:30", "Xem lịch tuần này").
- **Tự động hóa Google Calendar + Google Meet**: Tích hợp Google OAuth 2.0 và Google Calendar API (v3) tạo lịch kèm Google Meet link tự động với `conferenceDataVersion=1`.
- **Minh bạch & Kiểm soát (Human-in-the-loop confirmation)**: Không bao giờ tự ý tạo sự kiện khi chưa có xác nhận rõ ràng từ người dùng. Luôn hiển thị thẻ xem trước (Preview Card) đầy đủ thông tin: Tiêu đề, Thời gian bắt đầu/kết thúc, Múi giờ, Người tham gia, Mô tả trước khi bấm "Xác nhận tạo lịch".
- **Bảo mật tối đa**: Token Google, API key không bao giờ lộ ra client/trình duyệt, không đưa token vào prompt LLM, mã hóa session lưu trữ server-side qua HTTP-only cookies.
- **Khả năng tương thích & Ứng phó mô hình miễn phí**: Sử dụng OpenRouter model `nvidia/nemotron-3-ultra-550b-a55b:free` qua `@ai-sdk/openai` (`createOpenAI`). Hệ thống phải có cơ chế validate schema nghiêm ngặt, xử lý tool-calling đa bước có giới hạn (bounded multi-step loop) và fallback nhẹ nhàng khi model trả về lỗi hoặc thiếu thông tin.

## 3. Chân dung người dùng (Target Audience & Personas)
- **Nhân viên văn phòng, Quản lý dự án, Freelancer Việt Nam**: Thường xuyên trao đổi công việc, cần lên lịch hẹn nhanh chóng mà không muốn mở Google Calendar nhập liệu thủ công nhiều bước.
- **Người dùng di động và desktop**: Cần giao diện web responsive, hỗ trợ bàn phím, thao tác chạm nhanh và thân thiện trên cả smartphone và máy tính.

## 4. Các tính năng cốt lõi (Core Features)

### 4.1. Đăng nhập & Quản lý kết nối Google (Google OAuth Integration)
- Nút "Kết nối Google Calendar" rõ ràng trên giao diện.
- Luồng Google OAuth 2.0 Authorization Code flow với bảo vệ chống CSRF (state param), lưu trữ Refresh Token/Access Token an toàn trong cookie HTTP-only mã hóa.
- Hiển thị trạng thái kết nối: Email tài khoản đã kết nối, nút "Ngắt kết nối" (Disconnect) xóa session.
- Xử lý refresh access token tự động khi hết hạn.

### 4.2. Giao diện Chat thông minh (Conversational AI Interface)
- Giao diện chat dạng luồng tin nhắn (streaming text) hiện đại, hỗ trợ Markdown.
- Gợi ý câu lệnh mẫu (Prompt chips/Quick suggestions):
  - "Họp nhóm dự án vào 10h sáng mai trong 45 phút"
  - "Lên lịch 1-1 với partner@company.com chiều thứ 5 lúc 15:00"
  - "Xem các cuộc họp sắp tới của tôi"
- Nhận diện ngữ cảnh ngày giờ hiện tại dựa trên múi giờ người dùng (mặc định: `Asia/Ho_Chi_Minh` / GMT+7).

### 4.3. Thu thập thông tin & Hỏi bổ sung (Interactive Clarification)
- Nếu câu lệnh ban đầu thiếu thông tin quan trọng (tiêu đề, thời gian, thời lượng): AI sẽ hỏi lại bằng tiếng Việt lịch sự, tự nhiên.
- Hỗ trợ thời gian tương đối: "sáng mai", "chiều thứ sáu tới", "tuần sau", "30 phút nữa".

### 4.4. Thẻ xem trước & Xác nhận (Preview Card & Explicit Confirmation)
- Khi AI đã trích xuất đầy đủ thông tin sự kiện, giao diện hiển thị **Thẻ xác nhận cuộc họp (Meeting Confirmation Card)** gồm:
  - Tiêu đề cuộc họp (Title/Summary)
  - Ngày họp & Giờ bắt đầu - Giờ kết thúc (Start & End Time)
  - Múi giờ (Timezone, e.g., Asia/Ho_Chi_Minh)
  - Danh sách email người tham gia (Attendees)
  - Mô tả cuộc họp (Description)
  - Tùy chọn tạo Google Meet (Mặc định: Bật)
- Hai hành động:
  1. **"Xác nhận tạo lịch"**: Gửi lệnh tạo trực tiếp đến server API (chỉ gọi Google Calendar API sau khi user bấm).
  2. **"Chỉnh sửa / Hủy"**: Tiếp tục chat để sửa thông tin hoặc hủy bỏ.

### 4.5. Tạo sự kiện Google Calendar kèm Google Meet
- Gọi Google Calendar API `events.insert` với `conferenceDataVersion=1`.
- Sinh mã `requestId` duy nhất (UUID v4) cho mỗi yêu cầu conference để tránh duplicate conference request.
- Xử lý trạng thái trả về của Google Meet (`pending`, `success`, `failure`).
- Trả về thẻ kết quả thành công:
  - Nút "Mở Google Calendar" (`htmlLink`).
  - Nút "Tham gia Google Meet" (`hangoutLink`).
  - Nút "Sao chép link Meet".

### 4.6. Xem danh sách cuộc họp sắp tới (Upcoming Events Listing)
- Người dùng có thể yêu cầu: "Xem lịch hôm nay", "Lịch tuần này có gì không?".
- AI gọi tool `listUpcomingEvents` hiển thị danh sách cuộc họp sắp tới (thời gian, tiêu đề, link Meet).

### 4.7. Xử lý lỗi & Trải nghiệm ngoại lệ (Error Handling & Edge Cases)
- Khi chưa đăng nhập Google: AI hoặc UI hướng dẫn người dùng kết nối tài khoản.
- Khi token hết hạn hoặc bị thu hồi: Thông báo đăng nhập lại rõ ràng.
- Khi OpenRouter rate limit hoặc model quá tải: Thông báo lỗi thân thiện, gợi ý thử lại.
- Khi Google Calendar API gặp lỗi (ví dụ conflict, sai định dạng email attendee): Thông báo chi tiết lỗi và hướng giải quyết.

## 5. Yêu cầu phi chức năng (Non-Functional Requirements)
- **Hiệu năng**: Streaming response ngay khi model phản hồi. Thời gian tạo sự kiện < 2 giây sau khi xác nhận.
- **Bảo mật**:
  - Không lưu credentials trên repo hoặc client.
  - Session mã hóa bằng AES-256-GCM / JWE qua cookie HTTP-only, `SameSite=Lax`, `Secure`.
  - Giảm thiểu dữ liệu gửi đến LLM (chỉ gửi cấu trúc cần thiết, không gửi token, không gửi toàn bộ calendar data).
- **Khả năng tương thích (Responsiveness & Accessibility)**:
  - Tương thích tốt trên mobile (iOS Safari, Android Chrome), tablet và desktop.
  - Tuân thủ WCAG 2.1 AA về độ tương phản, hỗ trợ điều hướng bàn phím.
- **Ngôn ngữ**: 100% giao diện và phản hồi mặc định bằng tiếng Việt chuẩn mực, tự nhiên.

## 6. Tiêu chí nghiệm thu (Acceptance Criteria)
1. Kết nối Google OAuth thành công, nhận diện được tài khoản đã kết nối.
2. Chat tiếng Việt phân tích đúng thời gian tương đối theo múi giờ Việt Nam.
3. Thẻ xác nhận xuất hiện trước khi bất kỳ sự kiện nào được tạo.
4. Sự kiện được tạo trên Google Calendar có đầy đủ thông tin và đường link Google Meet hợp lệ (`https://meet.google.com/...`).
5. Tra cứu được danh sách sự kiện sắp tới.
6. Khi chưa cấu hình credentials hoặc bị ngắt kết nối, ứng dụng hiển thị trạng thái và thông báo chính xác, không crash.
