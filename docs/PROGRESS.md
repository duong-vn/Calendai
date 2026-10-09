# Calendai — Progress & Milestones Tracker

## Status Overview
- **Dự án**: Calendai (AI Google Calendar & Google Meet Assistant - Vietnamese First)
- **Trạng thái hiện tại**: Toàn bộ mã nguồn, cấu hình, giao diện, mock service, kiểm thử tự động (28/28 tests) và production build đã hoàn thành 100%.
- **Live Google Integration**: BLOCKED (Đang chờ Human điền credentials vào file `.env.local` theo hướng dẫn tại `docs/HUMAN_ACTIONS.md`).

---

## Danh sách các cột mốc (Milestones)

- [x] **Giai đoạn chuẩn bị (Phase 0: Planning & Documentation)**
  - [x] Tạo `docs/01-PRD.md`
  - [x] Tạo `docs/02-TRD.md`
  - [x] Tạo `docs/03-APP-FLOW.md`
  - [x] Tạo `docs/04-DESIGN-BRIEF.md`
  - [x] Tạo `docs/05-BACKGROUND-SCHEMA.md`
  - [x] Tạo `docs/06-IMPLEMENTATION-PLAN.md`
  - [x] Tạo `CLAUDE.md`, `docs/PROGRESS.md`, `docs/HUMAN_ACTIONS.md`

- [x] **Milestone 1: Khởi tạo dự án & Cấu hình nền tảng (Scaffolding & Tooling)**
  - [x] Khởi tạo Next.js 15 App Router, TypeScript, Tailwind CSS, Lucide React
  - [x] Cài đặt AI SDK (`ai`, `@ai-sdk/openai`, `zod`) và `jose`
  - [x] Thiết lập Vitest và test runner
  - [x] Tạo `.env.example` và validation `src/lib/env.ts`
  - [x] Chạy typecheck và test mẫu xác nhận (3/3 tests pass)

- [x] **Milestone 2: Tầng xác thực Google OAuth & Quản lý Session an toàn (Auth & Session Layer)**
  - [x] Triển khai JWE session encryption/decryption với `jose` (AES-256-GCM)
  - [x] Triển khai OAuth state generator & CSRF verification
  - [x] Xây dựng các API: `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/google/status`, `/api/auth/google/logout`
  - [x] Viết unit tests cho auth/session (10/10 tests pass)

- [x] **Milestone 3: Tầng dịch vụ Google Calendar & Mock Testing (Calendar Service Layer)**
  - [x] Xây dựng Google Calendar REST client (`conferenceDataVersion=1`, `hangoutsMeet`)
  - [x] Xây dựng Mock Calendar Service cho môi trường dev/test khi chưa có credentials
  - [x] Xây dựng API `/api/calendar/confirm` và `/api/calendar/upcoming`
  - [x] Viết unit tests cho Google Calendar Service & error handling (16/16 tests pass)

- [x] **Milestone 4: Tầng AI Chat với OpenRouter & Tool Calling (AI & LLM Integration)**
  - [x] Cấu hình `createOpenAI` adapter với OpenRouter
  - [x] Xây dựng System Prompt tiếng Việt chuẩn múi giờ `Asia/Ho_Chi_Minh`
  - [x] Cấu hình tool `proposeMeeting` và `listUpcomingEvents` với Zod schema
  - [x] Xây dựng API streaming `/api/chat` với bounded multi-step loop
  - [x] Viết unit tests cho AI tool validation và system prompt (21/21 tests pass)

- [x] **Milestone 5: Giao diện Chat tiếng Việt & Các Thẻ tương tác (Vietnamese Chat UI)**
  - [x] Xây dựng Header (Google Auth status, Avatar, timezone display)
  - [x] Xây dựng Chat Interface (tin nhắn streaming, bong bóng chat tiếng Việt)
  - [x] Xây dựng `MeetingPreviewCard` (Xác nhận/Chỉnh sửa với loading và chống trùng lặp)
  - [x] Xây dựng `EventCreatedCard` (Google Meet link + copy + direct join button)
  - [x] Xây dựng `UpcomingEventsModal` (tra cứu lịch trình)
  - [x] Viết unit tests cho UI components (27/27 tests pass)
  - [x] Responsive UI kiểm thử trên cả mobile và desktop viewport

- [x] **Milestone 6: Kiểm thử tích hợp tự động & Build xác minh (Verification & Build)**
  - [x] Viết integration test luồng đề xuất -> tạo lịch -> tạo Meet (28/28 tests pass)
  - [x] Chạy `npm run typecheck` (0 errors)
  - [x] Chạy `npm run lint` (0 warnings, 0 errors)
  - [x] Chạy `npm test` (28/28 passed trên 8 file test)
  - [x] Chạy `npm run build` (Biên dịch thành công 11 trang tĩnh và động)
  - [x] Chạy thử và xác minh trên trình duyệt qua Playwright MCP (tiêu đề, giao diện, modal, prompt chips hoạt động chuẩn xác)

- [x] **Milestone 7: Hoàn thiện tài liệu & Handoff (Final Handoff)**
  - [x] Cập nhật `docs/HUMAN_ACTIONS.md` chi tiết với checklist từng bước và URLs chính thức
  - [x] Sẵn sàng bàn giao cho người dùng cấu hình credentials
