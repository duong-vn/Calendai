# Implementation Plan — Calendai

## 1. Tổng quan kế hoạch (Implementation Overview)
Kế hoạch triển khai được chia thành 7 cột mốc (milestones) độc lập và có thể kiểm chứng bằng kiểm thử tự động, mocks và lệnh build thực tế. Toàn bộ logic không phụ thuộc vào credentials tài khoản người dùng thực tế sẽ được hoàn thành 100% trước khi yêu cầu thao tác từ con người.

---

## 2. Các cột mốc thực hiện (Milestones & Work Breakdown)

### Milestone 1: Khởi tạo dự án & Cấu hình nền tảng (Scaffolding & Tooling)
- **Mục tiêu**: Thiết lập Next.js 15 App Router, TypeScript, Tailwind CSS, Lucide icons, và môi trường kiểm thử Vitest.
- **Nhiệm vụ**:
  1. Khởi tạo Next.js với TypeScript, Tailwind CSS, ESLint, App Router.
  2. Cài đặt các gói phụ thuộc:
     - AI: `ai`, `@ai-sdk/openai`, `zod`
     - Auth/Session: `jose` (chuẩn web crypto, không phụ thuộc native C-bindings, chạy mượt trên mọi runtime)
     - Icons & Utilities: `lucide-react`, `clsx`, `tailwind-merge`
     - Testing: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `happy-dom`
  3. Cấu hình file `vitest.config.ts`, `tsconfig.json`.
  4. Tạo `.env.example` với đầy đủ placeholder và hướng dẫn.
  5. Cấu hình biến môi trường và file kiểm tra cấu hình `src/lib/env.ts`.
- **Kiểm chứng**:
  - `npm run lint` & `npm run typecheck` vượt qua không lỗi.
  - Chạy thử một test mẫu với `npm test`.

---

### Milestone 2: Tầng xác thực Google OAuth & Quản lý Session an toàn (Auth & Session Layer)
- **Mục tiêu**: Triển khai luồng OAuth 2.0 an toàn, mã hóa session HTTP-only, bảo vệ chống CSRF, tự động làm mới access token.
- **Nhiệm vụ**:
  1. Viết module mã hóa session `src/lib/auth/session.ts` dùng `jose` (JWE compact encryption với AES-256-GCM qua secret key).
  2. Viết OAuth helper `src/lib/auth/google-oauth.ts`:
     - Tạo Google authorization URL kèm PKCE / state ngẫu nhiên.
     - Hàm trao đổi auth code lấy access token + refresh token.
     - Hàm refresh access token khi gần hết hạn.
  3. Triển khai các API Routes:
     - `GET /api/auth/google`: Khởi tạo state, đặt cookie và chuyển hướng sang Google.
     - `GET /api/auth/google/callback`: So khớp state, lấy token, mã hóa session cookie, điều hướng về app.
     - `GET /api/auth/google/status`: Kiểm tra trạng thái đăng nhập và profile.
     - `POST /api/auth/google/logout`: Xóa session cookie.
  4. Viết unit tests cho session encryption/decryption, OAuth state validation.
- **Kiểm chứng**:
  - Chạy `npm test src/lib/auth/__tests__`. Tất cả test crypto và token logic pass 100%.

---

### Milestone 3: Tầng dịch vụ Google Calendar & Mock Testing (Calendar Service Layer)
- **Mục tiêu**: Xây dựng client tương tác Google Calendar API v3 trực tiếp, hỗ trợ `conferenceDataVersion=1`, sinh `requestId` duy nhất, định dạng timezone chuẩn, xử lý phản hồi Meet.
- **Nhiệm vụ**:
  1. Xây dựng `src/lib/calendar/google-calendar-service.ts`:
     - Hàm `createCalendarEvent`: Gọi `POST https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1` với body chuẩn, kèm `conferenceSolutionKey.type = 'hangoutsMeet'`.
     - Hàm `listUpcomingEvents`: Lấy sự kiện với `timeMin`, format kết quả gọn nhẹ.
     - Xử lý lỗi Google API (401 invalid token, 403 quota, 400 bad request).
  2. Viết Mock Google Calendar Service `src/lib/calendar/__mocks__/mock-calendar.ts` để phục vụ test và chạy dev offline khi chưa có Google credentials.
  3. Triển khai API Route `POST /api/calendar/confirm`:
     - Nhận payload xác nhận cuộc họp từ client.
     - Kiểm tra session đăng nhập và token.
     - Gọi `createCalendarEvent` để ghi vào Google Calendar.
     - Trả về thông tin sự kiện và link Meet.
  4. Triển khai API Route `GET /api/calendar/upcoming`.
  5. Viết unit tests cho Calendar Service với kịch bản: tạo event thành công có Meet, xử lý lỗi token hết hạn, xử lý timezone.
- **Kiểm chứng**:
  - Chạy `npm test src/lib/calendar/__tests__`.

---

### Milestone 4: Tầng AI Chat với OpenRouter & Tool Calling (AI & LLM Integration)
- **Mục tiêu**: Tích hợp Vercel AI SDK với OpenRouter qua `@ai-sdk/openai`, xây dựng System Prompt tiếng Việt chuyên sâu về lịch, tool `proposeMeeting` và `listUpcomingEvents`.
- **Nhiệm vụ**:
  1. Xây dựng `src/lib/ai/provider.ts`:
     - Khởi tạo `createOpenAI` trỏ về `OPENROUTER_BASE_URL` và `OPENROUTER_API_KEY`.
     - Xuất model `getChatModel()` dùng `OPENROUTER_MODEL`.
  2. Xây dựng System Prompt `src/lib/ai/system-prompt.ts`:
     - Truyền thời gian hiện tại chính xác (giờ, ngày, thứ, tháng, năm theo múi giờ `Asia/Ho_Chi_Minh`).
     - Hướng dẫn model giao tiếp tiếng Việt tự nhiên, lịch sự.
     - Quy tắc thu thập thông tin: hỏi lại nếu thiếu ngày/giờ/tiêu đề; khi đủ thì gọi `proposeMeeting`.
     - Nguyên tắc bảo mật: Không bao giờ bịa đặt đã tạo sự kiện trên Google khi chưa có xác nhận từ người dùng.
  3. Xây dựng API Route `POST /api/chat`:
     - Thiết lập `streamText` với `maxSteps: 3`.
     - Khai báo tool `proposeMeeting` với Zod schema xác thực.
     - Khai báo tool `listUpcomingEvents`.
     - Xử lý các lỗi stream, rate limit, fallback tin nhắn.
  4. Viết unit test cho prompt builder, zod schema validation cho tool.
- **Kiểm chứng**:
  - Chạy `npm test src/lib/ai/__tests__`.

---

### Milestone 5: Giao diện Chat tiếng Việt & Các Thẻ tương tác (Vietnamese Chat UI & Interactive Cards)
- **Mục tiêu**: Xây dựng giao diện chat responsive, chuẩn WCAG 2.1 AA, thẩm mỹ cao, hiển thị luồng tin nhắn, thẻ xem trước cuộc họp `MeetingPreviewCard`, thẻ kết quả `EventCreatedCard`, thẻ danh sách sự kiện `UpcomingEventsCard`.
- **Nhiệm vụ**:
  1. Xây dựng Layout tổng thể:
     - Header: Logo Calendai, Huy hiệu trạng thái kết nối Google, Avatar/Nút Đăng nhập, Nút xem lịch.
     - Cửa sổ chat trung tâm: Danh sách tin nhắn cuộn mượt mà, bong bóng chat tiếng Việt phân biệt màu sắc.
     - Thanh nhập tin nhắn (Input Bar): Gợi ý câu lệnh nhanh (Quick prompt chips), phím tắt gửi (Enter, Shift+Enter), chỉ báo AI đang phản hồi.
  2. Xây dựng Component `MeetingPreviewCard`:
     - Hiển thị thông tin cuộc họp (Tiêu đề, Bắt đầu - Kết thúc, Múi giờ Việt Nam, Người tham gia, Trạng thái Meet).
     - Nút "Xác nhận tạo lịch" (gọi `/api/calendar/confirm`) và Nút "Chỉnh sửa".
     - Trạng thái loading và disable nút sau khi bấm để chống duplicate.
  3. Xây dựng Component `EventCreatedCard`:
     - Hiển thị trạng thái thành công.
     - Hiển thị Google Meet link nổi bật, nút "Sao chép link", nút "Tham gia ngay".
     - Nút "Xem trên Google Calendar".
  4. Xây dựng Drawer / Modal "Sự kiện sắp tới".
  5. Xử lý toast notification thông báo khi sao chép link, khi lỗi kết nối, v.v.
- **Kiểm chứng**:
  - Giao diện render sạch sẽ, không có lỗi console.
  - Thử nghiệm trên mobile viewport và desktop viewport.

---

### Milestone 6: Kiểm thử tích hợp tự động & Build xác minh (Integration Tests & Production Build)
- **Mục tiêu**: Đảm bảo 100% test case tự động pass, chạy typecheck và build production hoàn tất không có cảnh báo nghiêm trọng.
- **Nhiệm vụ**:
  1. Viết integration test cho toàn bộ luồng chat -> propose meeting -> confirm -> create event.
  2. Viết test cho date-time parser và timezone converter.
  3. Kiểm tra bảo mật: Quét đảm bảo không có token, secret, hay API key nào bị rò rỉ ra client bundle.
  4. Chạy `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- **Kiểm chứng**:
  - Lệnh `npm run build` tạo thành công thư mục `.next` tối ưu hóa cho production.

---

### Milestone 7: Hoàn thiện tài liệu & Hướng dẫn thao tác cho người dùng (Documentation & Human Handoff)
- **Mục tiêu**: Cập nhật `CLAUDE.md`, `docs/PROGRESS.md` và `docs/HUMAN_ACTIONS.md` chi tiết, rõ ràng để người dùng chỉ cần làm các bước cấu hình Google Cloud là có thể chạy thử trực tiếp.
- **Nhiệm vụ**:
  1. Tạo `docs/HUMAN_ACTIONS.md` với từng checkbox, URL chính thức của Google Cloud Console, cài đặt OAuth consent screen, redirect URI chính xác, danh sách scope và các biến môi trường cần điền.
  2. Cập nhật `docs/PROGRESS.md` ghi nhận từng milestone đã hoàn thành kèm kết quả kiểm thử.
  3. Cập nhật `CLAUDE.md` với các quy tắc duy trì dự án Calendai.
- **Kiểm chứng**:
  - Bộ 6 tài liệu và các tài liệu bổ trợ đầy đủ, mạch lạc, không mâu thuẫn.
