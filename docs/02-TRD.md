# Technical Requirements Document (TRD) — Calendai

## 1. Kiến trúc hệ thống (System Architecture)

```
[Browser / Client (Next.js Client Components)]
       │
       ├─ (1) OAuth Redirect ──> Google OAuth 2.0 Server
       │                           │
       ├─ (2) OAuth Callback <─────┘ (Exchange Code -> Tokens in Encrypted HttpOnly Cookie)
       │
       ├─ (3) Chat Streaming (POST /api/chat) ──> [Next.js Route Handler]
       │                                                 │
       │                                                 ├─> OpenRouter (createOpenAI)
       │                                                 │     Model: nvidia/nemotron-3-ultra-550b-a55b:free
       │                                                 │     Base: https://openrouter.ai/api/v1
       │                                                 │
       │                                                 └─> Tool Calling:
       │                                                       - `proposeMeeting` (Emits Preview Card)
       │                                                       - `listUpcomingEvents` (Queries Google Calendar)
       │
       └─ (4) Confirm Meeting (POST /api/calendar/confirm) ──> [Next.js Route Handler]
                                                                      │
                                                                      └─> Google Calendar API v3
                                                                            (events.insert, conferenceDataVersion=1)
```

## 2. Công nghệ & Thư viện (Tech Stack & Dependencies)

- **Framework**: Next.js 15+ (App Router) với React 19, TypeScript (strict mode).
- **Styling**: Tailwind CSS v4 / PostCSS + Lucide React icons.
- **AI SDK**:
  - `ai` (Vercel AI SDK v4+)
  - `@ai-sdk/openai` (`createOpenAI` adapter tương thích OpenRouter)
  - `zod` (Validation schemas cho tool call & input)
- **Authentication & Session**:
  - `iron-session` hoặc `jose` (Mã hóa symmetric AES-256-GCM lưu trữ accessToken, refreshToken trong cookie HTTP-only bảo mật)
- **Google Calendar Integration**:
  - `googleapis` hoặc trực tiếp fetch qua REST API Google Calendar v3 với typing đầy đủ (gọn nhẹ, không tải thừa SDK cồng kềnh)
- **Date & Time Utilities**:
  - `date-fns` hoặc `dayjs` (hỗ trợ timezone `Asia/Ho_Chi_Minh` và định dạng ISO 8601)
- **Testing**:
  - `vitest` / `@testing-library/react` (Unit test, integration test, mock Google API)
  - `@playwright/test` (E2E browser tests)

## 3. Biến môi trường (Environment Variables)

### 3.1. Bắt buộc cho LLM (Mandatory AI Stack)
```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

### 3.2. Bắt buộc cho Google OAuth & Ứng dụng
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=min-32-character-random-secret-for-cookie-encryption
```

## 4. Tích hợp AI & Xử lý OpenRouter

### 4.1. Cấu hình AI Provider
Sử dụng `@ai-sdk/openai`:
```typescript
import { createOpenAI } from '@ai-sdk/openai';

export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'Calendai AI Assistant',
  },
});

export const getChatModel = () => {
  const modelId = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free';
  return openrouter.chat(modelId);
};
```

### 4.2. Tool Calling & Bounded Multi-Step Execution
Đặc điểm model miễn phí `nvidia/nemotron-3-ultra-550b-a55b:free`:
- Có thể gặp lỗi định dạng tool arguments JSON.
- Không thể đảm bảo 100% tuân thủ structured outputs nếu không có schema validation.
- Giới hạn multi-step: tối đa 3-5 vòng lặp (`maxSteps: 3`).

Các Tools:
1. `proposeMeeting`:
   - **Mục đích**: Nhận diện đầy đủ thông tin cuộc họp và trả về cấu trúc để client hiển thị Thẻ xác nhận (Preview Card).
   - **Schema**:
     - `summary`: string (Tiêu đề cuộc họp)
     - `description`: string (Mô tả, nội dung cuộc họp)
     - `startDateTime`: string (ISO 8601 có timezone offset, e.g., `2026-10-10T09:00:00+07:00`)
     - `endDateTime`: string (ISO 8601 có timezone offset)
     - `timeZone`: string (mặc định `Asia/Ho_Chi_Minh`)
     - `attendees`: array of `{ email: string, name?: string }`
     - `createMeet`: boolean (mặc định true)
   - **Hành vi**: Không gọi trực tiếp Google API! Trả về đối tượng `proposal` để người dùng xác nhận trên UI.
2. `listUpcomingEvents`:
   - **Mục đích**: Lấy danh sách 5-10 sự kiện sắp tới từ Google Calendar của user (chỉ lấy `timeMin`, `timeMax`, `summary`, `start`, `end`, `hangoutLink`).
   - **Schema**:
     - `maxResults`: number (1-10)
     - `daysAhead`: number (1-14)
   - **Hành vi**: Nếu đã đăng nhập, gọi Google API server-side với token của user và trả về tóm tắt ngắn gọn cho LLM. Không bao giờ gửi dữ liệu nhạy cảm hoặc token cho LLM.

### 4.3. System Prompt & Context Injection
- Cung cấp ngày giờ hiện tại (`nowISO`, `nowDayOfWeek`, `timezone`).
- Định hướng ngôn ngữ: Tiếng Việt tự nhiên, thân thiện, rõ ràng.
- Quy tắc xử lý thời gian: Luôn suy luận thời gian tương đối dựa trên thời điểm hiện tại và múi giờ `Asia/Ho_Chi_Minh` (GMT+7).
- Quy tắc Human-in-the-loop: Khi người dùng muốn đặt lịch, thu thập đủ thông tin rồi gọi `proposeMeeting`. Tuyệt đối không nói "Tôi đã tạo sự kiện" khi sự kiện chưa được xác nhận và trả về ID từ Google.

## 5. Tích hợp Google Calendar & OAuth 2.0

### 5.1. Scopes tối thiểu (Least-Privilege Scopes)
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/calendar.events` (Tạo, xem và sửa các sự kiện lịch, không yêu cầu toàn quyền quản lý xóa toàn bộ calendar)

### 5.2. Luồng OAuth 2.0 & Session Security
1. **Khởi tạo OAuth (`/api/auth/google`)**:
   - Tạo mã `state` ngẫu nhiên (UUID hoặc HMAC có hạn sử dụng).
   - Lưu `state` vào cookie `oauth_state` (HttpOnly, SameSite=Lax, Secure).
   - Chuyển hướng người dùng đến Google OAuth consent với `access_type=offline`, `prompt=consent`.
2. **Callback (`/api/auth/google/callback`)**:
   - So khớp `state` từ query param với cookie `oauth_state`. Nếu không khớp -> Báo lỗi 403 CSRF.
   - Gửi authorization code lên Google token endpoint: `https://oauth2.googleapis.com/token`.
   - Nhận `access_token`, `refresh_token`, `expires_in`.
   - Lấy thông tin user (email, name, picture) từ `https://www.googleapis.com/oauth2/v2/userinfo`.
   - Mã hóa toàn bộ thông tin session vào cookie `calendai_session` (AES-256-GCM).
   - Xóa cookie `oauth_state` và redirect về trang chủ (`/`).
3. **Quản lý Token & Tự động Refresh**:
   - Mỗi khi gọi Google Calendar API, kiểm tra thời gian hết hạn (`expiresAt`).
   - Nếu sắp hết hạn (trong vòng 5 phút), tự động dùng `refresh_token` lấy `access_token` mới và cập nhật lại session cookie.

### 5.3. Tạo sự kiện Google Calendar kèm Google Meet
Gọi endpoint `POST https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1`:
Body payload:
```json
{
  "summary": "Họp review kế hoạch Q4",
  "description": "Thảo luận mục tiêu và phân công công việc",
  "start": {
    "dateTime": "2026-10-10T09:00:00+07:00",
    "timeZone": "Asia/Ho_Chi_Minh"
  },
  "end": {
    "dateTime": "2026-10-10T10:00:00+07:00",
    "timeZone": "Asia/Ho_Chi_Minh"
  },
  "attendees": [
    { "email": "teammate@example.com" }
  ],
  "conferenceData": {
    "createRequest": {
      "requestId": "<unique-uuid-v4>",
      "conferenceSolutionKey": {
        "type": "hangoutsMeet"
      }
    }
  }
}
```
Xử lý kết quả:
- Trích xuất `hangoutLink` (link Google Meet chính thức).
- Trích xuất `htmlLink` (link mở sự kiện trên Google Calendar).
- Kiểm tra `conferenceData.createRequest.status.statusCode` (`success`, `pending`, `failureing`). Nếu `pending`, hiển thị thông báo liên kết đang được khởi tạo.

## 6. Thiết kế API Endpoints

1. `GET /api/auth/google`: Khởi tạo đăng nhập Google.
2. `GET /api/auth/google/callback`: Nhận mã ủy quyền, lưu session.
3. `GET /api/auth/google/status`: Lấy trạng thái đăng nhập (đã kết nối hay chưa, email).
4. `POST /api/auth/google/logout`: Xóa session.
5. `POST /api/chat`: Nhận tin nhắn chat, trả về server-sent events stream (Vercel AI SDK).
6. `POST /api/calendar/confirm`: Endpoint nhận payload xác nhận từ client, kiểm tra session Google của người dùng, gọi Google Calendar API tạo sự kiện và trả về kết quả JSON chính thức.
7. `GET /api/calendar/upcoming`: Lấy danh sách sự kiện sắp tới.

## 7. Bảo mật & Phòng ngừa rủi ro (Security & Error Handling)
- **Zero Token Leakage**: Tokens không bao giờ được gửi vào client-side state hoặc LLM prompt.
- **CSRF Protection**: Bảo vệ toàn bộ luồng OAuth với cryptographically secure state parameter.
- **Rate Limit & Retry**: Xử lý HTTP 429 từ OpenRouter với exponential backoff.
- **Fail Gracefully**: Khi model trả về định dạng sai, hệ thống báo lỗi rõ ràng và yêu cầu người dùng lặp lại câu hỏi mà không làm treo giao diện.
- **Input Sanitization**: Kiểm tra chặt chẽ định dạng email của attendees, kiểm tra start time < end time.
