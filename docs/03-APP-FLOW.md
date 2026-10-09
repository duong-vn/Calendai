# App Flow — Calendai

## 1. Sơ đồ luồng tổng quan (High-Level User Journey)

```
[Khởi động / Landing]
         │
         ├── Chưa kết nối Google ──> [Bấm "Kết nối Google Calendar"] ──> [Google Consent Screen]
         │                                                                      │
         │                                                      [Callback & Lưu Session]
         │                                                                      │
         ▼                                                                      ▼
  [Giao diện Chat chính] <──────────────────────────────────────────────────────┘
         │
         ├── Người dùng nhập yêu cầu tự nhiên bằng Tiếng Việt
         │   (VD: "Đặt lịch họp với đối tác sáng mai lúc 9h")
         │
         ├── [AI phân tích ngữ cảnh & thời gian]
         │       │
         │       ├── THIẾU THÔNG TIN (thiếu tiêu đề / giờ / người tham gia nếu cần)
         │       │       │
         │       │       ▼
         │       │   [AI đặt câu hỏi bổ sung bằng tiếng Việt] ──> (Người dùng trả lời)
         │       │
         │       └── ĐỦ THÔNG TIN
         │               │
         │               ▼
         │           [AI kích hoạt tool `proposeMeeting`]
         │               │
         │               ▼
         │           [Hiển thị THẺ XEM TRƯỚC (Preview Card)]
         │           (Tiêu đề, Bắt đầu - Kết thúc, Múi giờ, Attendees, Link Meet ON)
         │               │
         │               ├── [Người dùng chọn: "Chỉnh sửa" / Đổi ý bằng chat]
         │               │       │
         │               │       ▼
         │               │   (Cập nhật lại thông tin qua chat)
         │               │
         │               └── [Người dùng bấm: "XÁC NHẬN TẠO LỊCH"]
         │                       │
         │                       ▼
         │                   [Gọi API POST /api/calendar/confirm]
         │                       │
         │                       ├── THÀNH CÔNG: Hiển thị Thẻ Kết Quả
         │                       │   - Link Google Calendar
         │                       │   - Link Google Meet & Nút sao chép
         │                       │   - Danh sách người tham gia
         │                       │
         │                       └── THẤT BẠI: Hiển thị thông báo lỗi
         │                           - Chi tiết lỗi (Token hết hạn, conflict, mạng)
         │                           - Nút Thử lại hoặc Đăng nhập lại
         │
         └── Người dùng yêu cầu xem lịch ("Lịch sắp tới của tôi", "Hôm nay có gì?")
                 │
                 ▼
             [AI gọi tool `listUpcomingEvents`]
                 │
                 ▼
             [Hiển thị Danh sách sự kiện sắp tới (Thời gian, Tiêu đề, Link Meet)]
```

---

## 2. Chi tiết các bước tương tác (Step-by-Step Flow Details)

### Bước 1: Kết nối tài khoản Google (Authentication Flow)
1. Người dùng truy cập trang chủ `http://localhost:3000`.
2. Hệ thống kiểm tra cookie session qua `GET /api/auth/google/status`:
   - Nếu chưa kết nối: Header hiển thị huy hiệu "Chưa kết nối Google" và nút "Kết nối Google". Người dùng vẫn có thể chat thử nghiệm, nhưng trước khi xác nhận tạo lịch hoặc tra cứu, hệ thống sẽ nhắc kết nối.
   - Nếu đã kết nối: Header hiển thị avatar, tên, email của người dùng kèm nút "Ngắt kết nối".
3. Khi bấm "Kết nối Google":
   - Chuyển hướng đến `/api/auth/google`.
   - Sinh mã CSRF `state`, đặt cookie và redirect sang trang cấp quyền của Google.
   - Người dùng đồng ý cấp quyền xem và quản lý sự kiện Calendar.
   - Google redirect về `/api/auth/google/callback?code=...&state=...`.
   - Server xác thực `state`, đổi `code` lấy token, lưu session mã hóa và chuyển về trang chủ với trạng thái "Đã kết nối thành công".

---

### Bước 2: Nhập yêu cầu đặt lịch bằng ngôn ngữ tự nhiên (Prompt Submission)
1. Người dùng nhập câu lệnh tiếng Việt vào khung chat (hoặc bấm vào chip gợi ý có sẵn).
   - Ví dụ: *"Tạo cuộc họp Đánh giá Sprint vào 14h chiều thứ 2 tuần sau, mời nam@company.com và lan@company.com"*
2. Client gửi tin nhắn kèm lịch sử hội thoại lên `/api/chat`.
3. Server đính kèm ngữ cảnh hệ thống (thời gian hiện tại ở Việt Nam: ngày trong tuần, ngày, tháng, năm, giờ, phút, múi giờ `Asia/Ho_Chi_Minh`).
4. Server streaming phản hồi từ OpenRouter.

---

### Bước 3: Đặt câu hỏi bổ sung khi thiếu thông tin (Clarification Dialog)
- Nếu câu lệnh của người dùng mơ hồ:
  - *"Đặt lịch họp với anh Nam"* -> AI trả lời: *"Bạn muốn đặt lịch họp với anh Nam vào ngày nào và mấy giờ? Cuộc họp dự kiến kéo dài bao lâu?"*
  - *"Họp vào 9h sáng mai"* -> AI trả lời: *"Chủ đề hoặc tiêu đề của cuộc họp lúc 9h sáng mai là gì ạ? Bạn có muốn mời thêm ai không?"*
- Người dùng bổ sung thông tin qua các câu trả lời ngắn. AI ghi nhớ ngữ cảnh từ lịch sử chat.

---

### Bước 4: Hiển thị thẻ xem trước & Xác nhận (Preview Card Rendering)
- Khi đã đủ thông tin, AI gọi tool `proposeMeeting`.
- AI phản hồi tin nhắn: *"Tôi đã chuẩn bị thông tin cuộc họp. Vui lòng kiểm tra lại trước khi xác nhận nhé!"*
- Giao diện render component **`MeetingPreviewCard`** lồng ghép trực tiếp trong luồng chat:
  - 🏷️ **Tiêu đề**: Đánh giá Sprint Q4
  - 📅 **Ngày & Giờ**: Thứ Hai, 12/10/2026 | 14:00 - 15:00 (60 phút)
  - 🌐 **Múi giờ**: Asia/Ho_Chi_Minh (GMT+7)
  - 👥 **Người tham gia**: `nam@company.com`, `lan@company.com`
  - 📹 **Google Meet**: Tự động tạo liên kết video call
  - 📝 **Mô tả**: Đánh giá tiến độ và lập kế hoạch sprint tiếp theo
  - 🔘 **Hành động**:
    - Nút xanh nổi bật: **"Xác nhận tạo lịch"** (kèm icon lịch & meet)
    - Nút xám viền: **"Chỉnh sửa"** (focus vào ô chat để user nhập yêu cầu thay đổi)

---

### Bước 5: Xác nhận tạo lịch & Gọi Google Calendar API (Execution)
1. Người dùng bấm **"Xác nhận tạo lịch"** trên thẻ.
2. Thẻ chuyển sang trạng thái Loading (hiệu ứng spinner: *"Đang tạo sự kiện và liên kết Google Meet..."*).
3. Client gửi request `POST /api/calendar/confirm` chứa thông tin proposal:
   - Server kiểm tra session Google của người dùng.
   - Nếu chưa đăng nhập hoặc token không hợp lệ: Báo lỗi và mở popup kết nối Google.
   - Nếu token sắp hết hạn: Tự động refresh token bằng `refresh_token`.
   - Server gọi Google Calendar API `events.insert` với `conferenceDataVersion=1`.
4. Khi nhận kết quả từ Google:
   - Thẻ cập nhật thành trạng thái **`EventCreatedCard`**:
     - ✅ Thông báo thành công: *"Đã tạo sự kiện thành công trên Google Calendar!"*
     - 🔗 **Google Meet**: Hiển thị link dạng `https://meet.google.com/abc-defg-hij` kèm nút **"Sao chép link"** và nút **"Vào phòng họp"**.
     - 📅 **Google Calendar**: Nút **"Xem trên Google Calendar"** mở tab mới dẫn đến sự kiện.

---

### Bước 6: Tra cứu lịch trình sắp tới (List Upcoming Events Flow)
1. Người dùng chat: *"Xem lịch 3 ngày tới"* hoặc *"Hôm nay tôi có cuộc họp nào không?"*.
2. AI kích hoạt tool `listUpcomingEvents`.
3. Server lấy danh sách từ Google Calendar API với `timeMin = now`, định dạng ngắn gọn.
4. Giao diện hiển thị danh sách thẻ sự kiện gọn gàng (Upcoming Events Card list) gồm giờ bắt đầu, tiêu đề, link Meet nhanh nếu có.

---

### Bước 7: Phục hồi và xử lý lỗi (Error Recovery Flows)
- **Hết hạn quyền truy cập Google**: Hiển thị nút "Đăng nhập lại Google" ngay tại thẻ tin nhắn.
- **Lỗi mạng hoặc rate limit OpenRouter**: Hiển thị nút "Thử lại câu hỏi" mà không làm mất lịch sử hội thoại.
- **Trùng lặp yêu cầu**: Nút "Xác nhận tạo lịch" tự động vô hiệu hóa sau khi đã bấm để tránh spam tạo nhiều sự kiện giống nhau.
