# Calendai — Trợ Lý AI Đặt Lịch Google Calendar & Google Meet (Vietnamese-First)

Calendai là ứng dụng web trợ lý lịch trình AI ưu tiên tiếng Việt, cho phép người dùng lên lịch sự kiện trên **Google Calendar** và tự động sinh liên kết **Google Meet** thông qua giao diện hội thoại ngôn ngữ tự nhiên. Ứng dụng tích hợp cơ chế kiểm duyệt trước khi tạo lịch (Human-in-the-Loop), đảm bảo không bao giờ tự ý tạo sự kiện khi chưa có sự xác nhận của người dùng.

---

## Tính Năng Nổi Bật

- **Hội thoại tiếng Việt tự nhiên**: Phân tích câu lệnh đặt lịch tiếng Việt đa dạng ("Đặt lịch họp với đối tác sáng mai lúc 9h", "Lên lịch review code 14:00 thứ 6 tuần này").
- **Tự động sinh Google Meet**: Tích hợp Google Calendar API v3 (`conferenceDataVersion=1`) sinh liên kết Google Meet chính thức kèm nút sao chép và tham gia nhanh.
- **Xác nhận trước khi tạo lịch (Human-in-the-Loop)**: AI hiển thị thẻ xem trước (Meeting Preview Card) gồm tiêu đề, thời gian, múi giờ Việt Nam (`Asia/Ho_Chi_Minh`), người tham gia và trạng thái Google Meet trước khi người dùng bấm "Xác nhận tạo lịch".
- **Bảo mật chuẩn mực**:
  - Google OAuth 2.0 Authorization Code flow với mã xác thực CSRF state.
  - Backend mã hóa session bằng JWE (AES-256-GCM). Web giữ trong cookie HttpOnly; app native giữ phiên JWE riêng trong SecureStore.
  - Google token chỉ được xử lý dạng rõ ở backend; bản mã phiên được giữ trên thiết bị. API key và client secret không được gửi xuống frontend/APK hoặc vào prompt của LLM.
- **Chế độ Mock thông minh**: Cho phép trải nghiệm toàn bộ luồng chat, xem trước thẻ cuộc họp và danh sách sự kiện ngay cả khi chưa kết nối Google Cloud credentials.
- **Tra cứu lịch sắp tới**: Xem nhanh các sự kiện sắp diễn ra trên Google Calendar kèm nút vào phòng họp Meet.
- **Responsive & Chuẩn Accessibility**: Tối ưu giao diện mượt mà trên cả máy tính và thiết bị di động, chuẩn WCAG 2.1 AA.

---

## Công Nghệ Sử Dụng (Tech Stack)

- **Framework**: Next.js 15 (App Router), React 19, TypeScript (Strict Mode).
- **Styling**: Tailwind CSS v4, Lucide React icons.
- **AI Integration**: Vercel AI SDK (`ai`), `@ai-sdk/openai` (`createOpenAI` adapter tương thích OpenRouter).
- **Xác thực & Mã hóa**: Google OAuth 2.0, `jose` (Web Crypto JWE AES-256-GCM).
- **Calendar API**: Google Calendar REST API v3.
- **Kiểm thử**: Vitest, React Testing Library, Playwright MCP.

---

## Cấu Trúc Dự Án

```text
Calendai/
├── .github/
│   ├── dependabot.yml              # Tự động kiểm tra cập nhật npm và GitHub Actions hàng tuần
│   └── workflows/ci.yml            # Kiểm tra web và mobile trên GitHub Actions
├── docs/                           # Bộ 6 tài liệu thiết kế & tài liệu vận hành
│   ├── 01-PRD.md                   # Product Requirements Document
│   ├── 02-TRD.md                   # Technical Requirements Document
│   ├── 03-APP-FLOW.md              # Sơ đồ luồng tương tác người dùng
│   ├── 04-DESIGN-BRIEF.md          # Tài liệu quy chuẩn thiết kế UI/UX
│   ├── 05-BACKGROUND-SCHEMA.md     # Cấu trúc thực thể & Zod Schemas
│   ├── 06-IMPLEMENTATION-PLAN.md   # Kế hoạch triển khai & nghiệm thu
│   ├── PROGRESS.md                 # Nhật ký tiến độ các cột mốc
│   └── HUMAN_ACTIONS.md            # Hướng dẫn chi tiết thiết lập Google Cloud
├── mobile/                         # Ứng dụng Expo native với cấu hình và kiểm thử riêng
├── public/                         # Tệp tĩnh của web
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   │   └── config/         # API cấu hình model chính & fallback cho admin
│   │   │   ├── auth/
│   │   │   │   ├── google/         # Đăng nhập Google, callback, trạng thái và đăng xuất
│   │   │   │   └── mobile/         # Đổi mã OAuth và làm mới phiên mobile
│   │   │   ├── calendar/
│   │   │   │   ├── confirm/        # Xác nhận tạo sự kiện
│   │   │   │   ├── conflicts/      # Kiểm tra sự kiện trùng giờ
│   │   │   │   ├── resolve/        # Xử lý sự kiện trùng giờ
│   │   │   │   └── upcoming/       # Tra cứu sự kiện sắp tới
│   │   │   ├── chat/               # Streaming chat route với AI SDK tool calling & fallback
│   │   │   ├── health/ai/          # Kiểm tra kết nối AI
│   │   │   └── models/             # Danh sách model AI
│   │   ├── admin/                  # Trang quản trị chọn model chính & fallback (/admin)
│   │   ├── globals.css             # Tailwind CSS styles
│   │   ├── layout.tsx              # Root Layout
│   │   ├── not-found.tsx           # Trang 404
│   │   ├── page.tsx                # Giao diện ứng dụng chính
│   │   ├── privacy/                # Chính sách quyền riêng tư
│   │   └── terms/                  # Điều khoản sử dụng
│   ├── components/                 # UI Components
│   │   ├── AdminModelSettings.tsx  # Biểu mẫu cấu hình model cho quản trị viên
│   │   ├── CalendarConflictChoices.tsx # Lựa chọn khi trùng lịch
│   │   ├── ChatHistoryModal.tsx     # Hộp thoại lịch sử hội thoại
│   │   ├── ChatInterface.tsx       # Khung chat streaming & danh sách tin nhắn
│   │   ├── ChatSidebar.tsx         # Thanh bên quản lý hội thoại
│   │   ├── EventCreatedCard.tsx    # Thẻ sự kiện thành công & Google Meet link
│   │   ├── Header.tsx              # Thanh điều hướng, avatar & Google status
│   │   ├── MeetingPreviewCard.tsx  # Thẻ xem trước & nút xác nhận tạo lịch
│   │   ├── PageHeader.tsx          # Điều hướng các trang chính sách & quản trị
│   │   ├── ReminderSettings.tsx    # Cài đặt nhắc lịch
│   │   ├── Sidenote.tsx            # Ghi chú bên lề
│   │   ├── ThemeToggle.tsx         # Chuyển giao diện sáng hoặc tối
│   │   └── UpcomingEventsModal.tsx # Hộp thoại tra cứu lịch trình sắp tới
│   └── lib/
│       ├── ai/                     # Provider OpenRouter, system prompt, tools
│       ├── auth/                   # Google OAuth và phiên mã hóa cho web, mobile
│       ├── calendar/               # Client Google Calendar & Mock service
│       ├── chat/                   # Lưu lịch sử hội thoại trên trình duyệt
│       └── env.ts                  # Zod validation cho biến môi trường
├── AGENTS.md                       # Quy chuẩn phát triển dự án
├── CLAUDE.md                       # Nạp chỉ dẫn từ AGENTS.md
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
git clone https://github.com/duong-vn/Calendai.git
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
# 1. Cấu hình AI Provider (Chuẩn OpenAI-compatible API)
AI_API_KEY=your_ai_api_key_here
AI_MODEL=gpt-4o-mini
AI_FALLBACK_MODEL=
AI_BASE_URL=https://api.openai.com/v1

# 2. Danh sách email quản trị viên (cách nhau bằng dấu phẩy) cho /admin
ADMIN_EMAILS=admin@example.com

# 3. Google OAuth 2.0 Credentials (Cần khi kết nối Calendar thật)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_client_secret

# 3. Base URL & Mã khóa Session
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=chuoi_bi_mat_ngau_nhien_toi_thieu_32_ky_tu_123456
```

> **Lưu ý**: Khi phát triển cục bộ, chưa cấu hình Google có thể dùng lịch mẫu. Production và request Bearer mobile không tạo/đọc lịch mẫu thay cho Google Calendar thật. Xem hướng dẫn Google Cloud tại `docs/HUMAN_ACTIONS.md`. Production cần `SESSION_SECRET` ngẫu nhiên tối thiểu 32 ký tự, không dùng khóa development/mẫu.

### Ứng dụng Expo native

Code tại [`mobile/`](mobile/README.md), dùng cùng backend `https://calendai.tduong.online`. Google Sign-In SDK nhận server authorization code, gửi tới `POST /api/auth/mobile/exchange`; backend đổi với Google và trả phiên mobile JWE. App giữ phiên trong SecureStore và gọi API bằng Bearer. `POST /api/auth/mobile/refresh` trả phiên mới nhưng không kéo dài hạn tuyệt đối đăng nhập 30 ngày. Không dùng Redis/DB phiên.

Cần Google OAuth Android client gắn đúng package và SHA-1 chứng chỉ ký APK, cùng web client tương ứng backend. Không chỉ cấu hình URL là đăng nhập native được. Logout xóa phiên ở thiết bị; không thu hồi mọi JWE đã cấp hoặc quyền Google. Chi tiết cấu hình và kiểm thử thiết bị nằm trong README mobile.

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

## Triển Khai Production

- Vercel chạy web và API tại `https://calendai.tduong.online`. Nhánh PR có bản Preview. Khi có commit mới trên `main`, Vercel tự tạo bản Production. Theo dõi trạng thái trong tab **Deployments** của dự án. [Triển khai qua Git trên Vercel](https://vercel.com/docs/git)
- Máy local dùng `.env.local`. Trên Vercel, vào **Settings → Environment Variables** của dự án và chọn **Production** khi khai báo `AI_API_KEY`, `AI_MODEL`, `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`. Có thể khai báo thêm `AI_FALLBACK_MODEL` (model dự phòng) và `ADMIN_EMAILS` (danh sách email Google được phép truy cập `/admin`, phân tách bằng dấu phẩy). Đặt `SESSION_SECRET` ngẫu nhiên tối thiểu 32 ký tự và cấu hình `AI_BASE_URL` nếu dùng endpoint khác mặc định. Thay đổi biến có hiệu lực ở lần triển khai tiếp theo. [Biến môi trường trên Vercel](https://vercel.com/docs/environment-variables)
- Trang quản trị `/admin` lưu cấu hình model vào tệp JSON phía máy chủ (`data/admin-config.json` cục bộ, `/tmp/calendai-admin-config.json` trên Vercel) kết hợp cache bộ nhớ để áp dụng ngay không cần deploy lại. Lưu ý hạn chế của Vercel: hệ thống tệp của Vercel là ephemeral (tạm thời), nên sau mỗi lần deploy hoặc cold start, cấu hình có thể quay về giá trị biến môi trường (`AI_MODEL` / `AI_FALLBACK_MODEL`).
- Đặt `NEXT_PUBLIC_APP_URL=https://calendai.tduong.online` trong môi trường Production. Đăng ký `https://calendai.tduong.online/api/auth/google/callback` trong danh sách **Authorized redirect URIs** của Web OAuth client trên Google Cloud. Máy local dùng `http://localhost:3000` và callback tương ứng.

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

## Giám Sát Tình Trạng

- `GET /api/health/ai` trả HTTP 200 khi ứng dụng phản hồi. Dùng URL này cho UptimeRobot và các công cụ kiểm tra uptime định kỳ.
- `GET /api/health/ai/probe` kiểm tra mô hình AI mặc định và trả HTTP 503 nếu lần kiểm tra thất bại. Chỉ gọi khi cần chẩn đoán hoặc với tần suất thấp vì mỗi lần kiểm tra mới có thể phát sinh chi phí. Kết quả được giữ trong 60 giây trên mỗi tiến trình.

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
