# Hướng Dẫn Thao Tác Của Người Dùng (Human Actions Required)

Tài liệu này tổng hợp toàn bộ các bước thiết lập tài khoản Google Cloud và OpenRouter mà hệ thống AI không thể tự động thực hiện (do yêu cầu quyền truy cập cá nhân vào bảng điều khiển Google Cloud Console và OpenRouter).

Hệ thống Calendai đã hoàn thiện toàn bộ mã nguồn, logic xác thực, mock service và các bài kiểm thử tự động. Bạn chỉ cần thực hiện các bước dưới đây để kết nối tài khoản thật.

---

## 1. Trạng Thái Hiện Tại (Current Integration Status)
- [x] Kiến trúc, Mã nguồn, Giao diện, Mock Google Calendar, Vitest Tests: **HOÀN TẤT 100%**
- [ ] Tích hợp Live Google OAuth & Live Calendar Event Creation: **BLOCKED (Đang chờ Human cấu hình credentials)**

---

## 2. Bước 1: Lấy API Key OpenRouter

- **URL chính thức**: [https://openrouter.ai/keys](https://openrouter.ai/keys)
- **Các bước thực hiện**:
  1. Đăng nhập hoặc tạo tài khoản trên [OpenRouter](https://openrouter.ai).
  2. Vào mục **Keys** -> Nhấn **Create Key**.
  3. Đặt tên (ví dụ: `Calendai App`).
  4. Sao chép API key được cấp (dạng `sk-or-v1-...`).

---

## 3. Bước 2: Thiết Lập Google Cloud Project & Google Calendar API

- **URL Google Cloud Console**: [https://console.cloud.google.com/](https://console.cloud.google.com/)

### 3.1. Tạo Project mới
- [ ] Truy cập [Google Cloud Resource Manager](https://console.cloud.google.com/projectcreate) hoặc chọn **Select a project** -> **New Project**.
- [ ] Đặt tên dự án: `Calendai-Assistant` (hoặc tên tùy ý) -> Nhấn **Create**.

### 3.2. Kích hoạt Google Calendar API
- [ ] Vào mục **APIs & Services** -> **Library** (hoặc truy cập trực tiếp: [Google Calendar API Library](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)).
- [ ] Nhấn nút **Enable** (Bật API).

### 3.3. Cấu hình màn hình đồng ý OAuth (OAuth Consent Screen)
- [ ] Truy cập [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent).
- [ ] Chọn **User Type**:
  - Chọn **External** (Người dùng ngoài) -> Nhấn **Create**.
- [ ] Điền thông tin ứng dụng:
  - **App name**: `Calendai`
  - **User support email**: Chọn email của bạn.
  - **Developer contact information**: Nhập email của bạn.
  - Nhấn **Save and Continue**.
- [ ] Cấu hình **Scopes** (Phạm vi truy cập):
  - Nhấn **Add or Remove Scopes**.
  - Tìm và tích chọn 3 scope sau:
    1. `.../auth/userinfo.email`
    2. `.../auth/userinfo.profile`
    3. `https://www.googleapis.com/auth/calendar.events` (Xem, chỉnh sửa, tạo sự kiện lịch)
  - Nhấn **Update** -> Nhấn **Save and Continue**.
- [ ] Cấu hình **Test Users** (Người dùng thử nghiệm):
  - Nhấn **Add Users** -> Nhập địa chỉ Gmail mà bạn sẽ dùng để đăng nhập và tạo lịch thử nghiệm.
  - Nhấn **Add** -> Nhấn **Save and Continue**.

### 3.4. Tạo OAuth 2.0 Client ID (Thông tin xác thực)
- [ ] Truy cập [Credentials](https://console.cloud.google.com/apis/credentials).
- [ ] Nhấn **Create Credentials** -> Chọn **OAuth client ID**.
- [ ] **Application type**: Chọn **Web application**.
- [ ] **Name**: `Calendai Web Client`.
- [ ] **Authorized JavaScript origins**:
  - Thêm URI: `http://localhost:3000`
- [ ] **Authorized redirect URIs (CỰC KỲ QUAN TRỌNG)**:
  - Thêm chính xác URI sau:
    ```text
    http://localhost:3000/api/auth/google/callback
    ```
- [ ] Nhấn **Create**.
- [ ] Sao chép hai giá trị được cấp:
  - **Client ID** (Dạng: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`)
  - **Client Secret** (Dạng: `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx`)

---

## 4. Bước 3: Cấu Hình Biến Môi Trường (Local Environment)

Tạo file `.env.local` tại thư mục gốc dự án `D:\Calendai\.env.local` (sao chép từ `.env.example`) và điền các giá trị bạn vừa lấy:

```env
# ========================================================
# 1. OpenRouter AI Configuration (Bắt buộc)
# ========================================================
OPENROUTER_API_KEY=sk-or-v1-dien-api-key-cua-ban-o-day
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# ========================================================
# 2. Google OAuth 2.0 Credentials (Bắt buộc cho Live Calendar)
# ========================================================
GOOGLE_CLIENT_ID=dien-client-id-google-o-day.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-dien-client-secret-o-day

# ========================================================
# 3. App URL & Session Encryption Key
# ========================================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Chuỗi bí mật ngẫu nhiên tối thiểu 32 ký tự để mã hóa session cookie
SESSION_SECRET=calendai_super_secret_session_key_32_chars_long_123456
```

> **LƯU Ý BẢO MẬT**: Tuyệt đối không paste file `.env.local` hoặc các chuỗi secret vào ô chat, và không commit file này lên Git.

---

## 5. Bước 4: Kiểm Thử Thực Tế (Live Testing)

Sau khi bạn đã cấu hình `.env.local`:
1. Chạy ứng dụng:
   ```bash
   npm run dev
   ```
2. Mở trình duyệt tại `http://localhost:3000`.
3. Bấm nút **"Kết nối Google"** ở góc trên bên phải.
4. Chọn tài khoản Google (tài khoản đã thêm vào danh sách Test Users ở Bước 3.3).
5. Nhấn **Tiếp tục / Cho phép** cấp quyền Calendar.
6. Quay lại giao diện Calendai và chat câu lệnh thử nghiệm:
   > *"Tạo cuộc họp Thử nghiệm Calendai vào 9h sáng mai trong 30 phút, có link Google Meet nhé"*
7. Kiểm tra Thẻ xem trước cuộc họp -> Nhấn **"Xác nhận tạo lịch"**.
8. Nhận kết quả có đường link Google Meet (`https://meet.google.com/...`) và đường link mở sự kiện trực tiếp trên Google Calendar.
