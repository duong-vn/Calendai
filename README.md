# Calendai — Trợ Lý AI Đặt Lịch Google Calendar & Google Meet (Vietnamese-First)

Calendai là ứng dụng web trợ lý lịch trình AI ưu tiên tiếng Việt, cho phép người dùng lên lịch sự kiện trên **Google Calendar** và tự động sinh liên kết **Google Meet** thông qua giao diện hội thoại ngôn ngữ tự nhiên. Ứng dụng tích hợp cơ chế kiểm duyệt trước khi tạo lịch (Human-in-the-Loop), đảm bảo không bao giờ tự ý tạo sự kiện khi chưa có sự xác nhận của người dùng.

---

## Tính Năng Nổi Bật

- **Hội thoại tiếng Việt tự nhiên**: Phân tích câu lệnh đặt lịch tiếng Việt đa dạng ("Đặt lịch họp với đối tác sáng mai lúc 9h", "Lên lịch review code 14:00 thứ 6 tuần này").
- **Tự động sinh Google Meet**: Tích hợp Google Calendar API v3 (`conferenceDataVersion=1`) sinh liên kết Google Meet chính thức kèm nút sao chép và tham gia nhanh.
- **Xác nhận trước khi tạo lịch (Human-in-the-Loop)**: AI hiển thị thẻ xem trước (Meeting Preview Card) gồm tiêu đề, thời gian, múi giờ Việt Nam (`Asia/Ho_Chi_Minh`), người tham gia và trạng thái Google Meet trước khi người dùng bấm "Xác nhận tạo lịch".
- **Bảo mật chuẩn mực**:
  - Google OAuth 2.0 Authorization Code flow với mã xác thực CSRF state.
  - Lưu trữ session mã hóa server-side bằng JWE (AES-256-GCM) qua cookie HTTP-Only.
  - Tokens và secrets không bao giờ bị rò rỉ ra client hoặc đưa vào prompt của LLM.
- **Chế độ Mock thông minh**: Cho phép trải nghiệm toàn bộ luồng chat, xem trước thẻ cuộc họp và danh sách sự kiện ngay cả khi chưa kết nối Google Cloud credentials.
- **Tra cứu lịch sắp tới**: Xem nhanh các sự kiện sắp diễn ra trên Google Calendar kèm nút vào phòng họp Meet.
- **Responsive & Chuẩn Accessibility**: Tối ưu giao diện mượt mà trên cả máy tính và thiết bị di động, chuẩn WCAG 2.1 AA.

---

## Công Nghệ Sử Dụng (Tech Stack)

- **Framework**: Next.js 15 (App Router), React 19, TypeScript (Strict Mode).
- **Styling**: Tailwind CSS v4, Lucide React icons.
- **AI Integration**: Vercel AI SDK (`ai`), `@ai-sdk/openai` (`createOpenAI` adapter tương thích OpenRouter).
- **Model**: `nvidia/nemotron-3-ultra-550b-a55b:free` qua OpenRouter.
- **Xác thực & Mã hóa**: Google OAuth 2.0, `jose` (Web Crypto JWE AES-256-GCM).
- **Calendar API**: Google Calendar REST API v3.
- **Kiểm thử**: Vitest, React Testing Library, Playwright MCP.

---

## Cấu Trúc Dự Án

```text
Calendai/
├── docs/                           # Bộ 6 tài liệu thiết kế & tài liệu vận hành
│   ├── 01-PRD.md                   # Product Requirements Document
│   ├── 02-TRD.md                   # Technical Requirements Document
│   ├── 03-APP-FLOW.md              # Sơ đồ luồng tương tác người dùng
│   ├── 04-DESIGN-BRIEF.md          # Tài liệu quy chuẩn thiết kế UI/UX
│   ├── 05-BACKGROUND-SCHEMA.md     # Cấu trúc thực thể & Zod Schemas
│   ├── 06-IMPLEMENTATION-PLAN.md   # Kế hoạch triển khai & nghiệm thu
│   ├── PROGRESS.md                 # Nhật ký tiến độ các cột mốc
│   └── HUMAN_ACTIONS.md            # Hướng dẫn chi tiết thiết lập Google Cloud
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/
│   │   │   ├── auth/google/        # Google OAuth login, callback, status, logout
│   │   │   ├── calendar/           # Endpoints confirm tạo lịch & upcoming events
│   │   │   └── chat/               # Streaming chat route với AI SDK tool calling
│   │   ├── globals.css             # Tailwind CSS styles
│   │   ├── layout.tsx              # Root Layout
│   │   └── page.tsx                # Giao diện ứng dụng chính
│   ├── components/                 # UI Components
│   │   ├── Header.tsx              # Thanh điều hướng, avatar & Google status
│   │   ├── ChatInterface.tsx       # Khung chat streaming & danh sách tin nhắn
│   │   ├── MeetingPreviewCard.tsx  # Thẻ xem trước & nút xác nhận tạo lịch
│   │   ├── EventCreatedCard.tsx    # Thẻ sự kiện thành công & Google Meet link
│   │   └── UpcomingEventsModal.tsx # Hộp thoại tra cứu lịch trình sắp tới
│   └── lib/
│       ├── ai/                     # Provider OpenRouter, system prompt, tools
│       ├── auth/                   # Session encryption, Google OAuth helpers
│       ├── calendar/               # Client Google Calendar & Mock service
│       └── env.ts                  # Zod validation cho biến môi trường
├── CLAUDE.md                       # Quy chuẩn phát triển dự án
├── vitest.config.ts                # Cấu hình test runner Vitest
└── .env.example                    # Mẫu khai báo biến môi trường
```

---

## Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Getting Started)

### 1. Yêu cầu môi trường
- Node.js >= 20.x (khuyến nghị v22+ hoặc v24+).
- npm >= 10.x.

### 2. Cài đặt dependencies
```bash
git clone https://github.com/<your-username>/Calendai.git
cd Calendai
npm install
```

### 3. Cấu hình biến môi trường
Sao chép file `.env.example` thành `.env.local`:
```bash
cp .env.example .env.local
```

Mở `.env.local` và điền các thông tin:
```env
# 1. OpenRouter AI (Bắt buộc để chat AI)
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# 2. Google OAuth 2.0 Credentials (Cần khi kết nối Calendar thật)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_client_secret

# 3. Base URL & Mã khóa Session
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=chuoi_bi_mat_ngau_nhien_toi_thieu_32_ky_tu_123456
```

> **Lưu ý**: Nếu chưa cấu hình `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`, ứng dụng sẽ tự động kích hoạt **Chế độ Mock** để bạn kiểm thử toàn bộ giao diện và chức năng mà không gặp lỗi. Xem hướng dẫn tạo credentials tại `docs/HUMAN_ACTIONS.md`.

### 4. Khởi chạy ứng dụng

Chạy môi trường phát triển:
```bash
npm run dev
```
Mở trình duyệt tại [http://localhost:3000](http://localhost:3000).

Chạy bản build production:
```bash
npm run build
npm start
```

---

## Kiểm Thử & Xác Minh (Testing & Quality)

Dự án có hệ thống kiểm thử toàn diện:

- **Chạy toàn bộ Unit & Integration Tests**:
  ```bash
  npm test
  ```
  *(28/28 tests passed trên 8 test suites)*

- **Kiểm tra kiểu dữ liệu TypeScript**:
  ```bash
  npm run typecheck
  ```

- **Kiểm tra Lint**:
  ```bash
  npm run lint
  ```

---

## Thiết Lập Google Cloud OAuth Thật

Để kết nối với tài khoản Google thực tế và tạo sự kiện thật trên Google Calendar:
1. Đọc hướng dẫn chi tiết từng bước tại file **[`docs/HUMAN_ACTIONS.md`](docs/HUMAN_ACTIONS.md)**.
2. Tạo project trên [Google Cloud Console](https://console.cloud.google.com/).
3. Bật **Google Calendar API**.
4. Cấu hình OAuth consent screen với phạm vi `.../auth/calendar.events`.
5. Tạo Web OAuth Client ID với Redirect URI: `http://localhost:3000/api/auth/google/callback`.
6. Điền Client ID & Client Secret vào `.env.local`.

---

## Giấy Phép (License)

Dự án phát hành dưới giấy phép MIT.
