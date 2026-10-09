# Background Schema — Calendai

## 1. Mô hình thực thể & Mối quan hệ (Entity Relationship Diagram - ERD)

```
[User Session (Encrypted Cookie)]
  ├── id: string (UUID / Google Sub)
  ├── email: string
  ├── name: string
  ├── picture: string
  ├── tokens: GoogleTokens (accessToken, refreshToken, expiresAt)
  └── createdAt: timestamp
          │
          ├── (Thực hiện hội thoại)
          ▼
[Chat Conversation (Client / Transient State)]
  ├── id: string
  └── messages: Array<ChatMessage>
          │
          ├── (AI đề xuất tạo lịch)
          ▼
[Meeting Proposal (Tool Call Result)]
  ├── id: string (Proposal UUID)
  ├── summary: string
  ├── description?: string
  ├── startDateTime: ISO8601String
  ├── endDateTime: ISO8601String
  ├── timeZone: string (Asia/Ho_Chi_Minh)
  ├── attendees: Array<Attendee>
  ├── createMeet: boolean
  └── status: 'proposed' | 'confirming' | 'confirmed' | 'cancelled'
          │
          ├── (User bấm xác nhận)
          ▼
[Google Calendar Event (Google Cloud)]
  ├── id: string (Google Event ID)
  ├── htmlLink: string (Google Calendar URL)
  ├── hangoutLink?: string (Google Meet URL)
  ├── status: 'confirmed'
  └── conferenceData?: ConferenceData (requestId, solution, status)
```

---

## 2. Cấu trúc dữ liệu & TypeScript Types

### 2.1. Xác thực & Session (Auth & Session Models)

```typescript
export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp in milliseconds
  tokenType: string;
  scope: string;
}

export interface UserProfile {
  id: string; // Google user ID (sub)
  email: string;
  name: string;
  picture?: string;
}

export interface SessionData {
  user: UserProfile;
  tokens: GoogleTokens;
  createdAt: number;
}
```

### 2.2. Chat & AI Tool Schemas

#### A. Schema đề xuất cuộc họp (`proposeMeeting`)
Sử dụng Zod Schema để validate tham số truyền từ LLM:

```typescript
import { z } from 'zod';

export const AttendeeSchema = z.object({
  email: z.string().email('Địa chỉ email người tham gia không hợp lệ'),
  name: z.string().optional(),
});

export const ProposeMeetingSchema = z.object({
  summary: z.string().min(1, 'Tiêu đề cuộc họp không được để trống'),
  description: z.string().optional().default(''),
  startDateTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Thời gian bắt đầu phải theo định dạng ISO 8601 hợp lệ',
  }),
  endDateTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Thời gian kết thúc phải theo định dạng ISO 8601 hợp lệ',
  }),
  timeZone: z.string().default('Asia/Ho_Chi_Minh'),
  attendees: z.array(AttendeeSchema).optional().default([]),
  createMeet: z.boolean().default(true),
});

export type ProposeMeetingInput = z.infer<typeof ProposeMeetingSchema>;

export interface MeetingProposal extends ProposeMeetingInput {
  proposalId: string; // UUID v4 sinh ra trên server
  createdAt: string;
}
```

#### B. Schema tra cứu sự kiện (`listUpcomingEvents`)

```typescript
export const ListUpcomingEventsSchema = z.object({
  maxResults: z.number().int().min(1).max(10).default(5),
  daysAhead: z.number().int().min(1).max(14).default(7),
});

export type ListUpcomingEventsInput = z.infer<typeof ListUpcomingEventsSchema>;

export interface CalendarEventSummary {
  id: string;
  summary: string;
  description?: string;
  start: string; // ISO string
  end: string;   // ISO string
  hangoutLink?: string;
  htmlLink: string;
  isAllDay: boolean;
}
```

---

## 3. Cấu trúc Payload Google Calendar API v3

### 3.1. Insert Event Request (`POST /calendars/primary/events?conferenceDataVersion=1`)
```json
{
  "summary": "Phỏng vấn ứng viên Frontend",
  "description": "Trao đổi chuyên môn và định hướng dự án",
  "start": {
    "dateTime": "2026-10-12T10:00:00+07:00",
    "timeZone": "Asia/Ho_Chi_Minh"
  },
  "end": {
    "dateTime": "2026-10-12T11:00:00+07:00",
    "timeZone": "Asia/Ho_Chi_Minh"
  },
  "attendees": [
    { "email": "candidate@gmail.com" }
  ],
  "conferenceData": {
    "createRequest": {
      "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "conferenceSolutionKey": {
        "type": "hangoutsMeet"
      }
    }
  }
}
```

### 3.2. Insert Event Response Format (Trích xuất các trường cốt lõi)
```json
{
  "id": "abc123googleeventid",
  "status": "confirmed",
  "htmlLink": "https://www.google.com/calendar/event?eid=YWJjMTIz...",
  "summary": "Phỏng vấn ứng viên Frontend",
  "start": {
    "dateTime": "2026-10-12T10:00:00+07:00",
    "timeZone": "Asia/Ho_Chi_Minh"
  },
  "end": {
    "dateTime": "2026-10-12T11:00:00+07:00",
    "timeZone": "Asia/Ho_Chi_Minh"
  },
  "hangoutLink": "https://meet.google.com/xyz-uvwx-rst",
  "conferenceData": {
    "createRequest": {
      "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "status": {
        "statusCode": "success"
      }
    },
    "entryPoints": [
      {
        "entryPointType": "video",
        "uri": "https://meet.google.com/xyz-uvwx-rst",
        "label": "meet.google.com/xyz-uvwx-rst"
      }
    ]
  }
}
```

---

## 4. API Request & Response Contracts

### 4.1. `POST /api/calendar/confirm`
- **Request Body**:
```json
{
  "summary": "Họp Kickoff Dự Án",
  "description": "Thảo luận kế hoạch triển khai",
  "startDateTime": "2026-10-13T09:00:00+07:00",
  "endDateTime": "2026-10-13T10:00:00+07:00",
  "timeZone": "Asia/Ho_Chi_Minh",
  "attendees": [
    { "email": "dev@company.com" }
  ],
  "createMeet": true,
  "proposalId": "f784d142-9f37-4d92-8088-752485e94b79"
}
```
- **Response Success (200 OK)**:
```json
{
  "success": true,
  "event": {
    "id": "event_id_google",
    "summary": "Họp Kickoff Dự Án",
    "start": "2026-10-13T09:00:00+07:00",
    "end": "2026-10-13T10:00:00+07:00",
    "htmlLink": "https://calendar.google.com/...",
    "hangoutLink": "https://meet.google.com/abc-defg-hij",
    "attendees": ["dev@company.com"]
  }
}
```
- **Response Error (401 Unauthorized / 400 Bad Request / 500 Internal Error)**:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED" | "VALIDATION_FAILED" | "GOOGLE_API_ERROR",
    "message": "Vui lòng kết nối tài khoản Google để tạo sự kiện lịch."
  }
}
```

### 4.2. `GET /api/auth/google/status`
- **Response (200 OK)**:
```json
{
  "authenticated": true,
  "user": {
    "id": "1083921039120",
    "email": "user@gmail.com",
    "name": "Nguyen Van A",
    "picture": "https://lh3.googleusercontent.com/..."
  }
}
```
hoặc:
```json
{
  "authenticated": false,
  "user": null
}
```
