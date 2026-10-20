# Calendai Mobile (Expo / React Native)

Ứng dụng di động Calendai - Trợ lý đặt lịch hẹn tiếng Việt kết hợp Google Calendar & Google Meet (Kiến trúc Phương án C: Agenda Dashboard).

## Tính năng
- **Agenda Dashboard**: Xem trực tiếp danh sách các cuộc họp trong ngày, tích hợp mở link Google Meet 1-chạm.
- **Voice Assistant & Quick Chips**: Nút Mic nhận diện giọng nói tiếng Việt và các lệnh gợi ý nhanh (họp nhóm, gặp đối tác, tra cứu lịch).
- **Chrono-Confirm**: Modal xác nhận tạo sự kiện chuẩn Human-in-the-loop trước khi lưu lên Google Calendar.
- **Kết nối Backend Next.js**: Đồng bộ với các API `/api/calendar/upcoming`, `/api/calendar/confirm`, `/api/auth/google/status`.

## Hướng dẫn chạy

1. Cài đặt dependency:
```bash
cd mobile
npm install
```

2. Khởi động app:
```bash
npm start
```

3. Mở ứng dụng:
- Dùng app **Expo Go** trên điện thoại (quét mã QR trên màn hình).
- Hoặc bấm `a` để chạy trên Android Emulator, `i` trên iOS Simulator.

*Lưu ý khi test máy thật:* Trong `src/services/api.ts`, thay `http://localhost:3000` thành IP mạng LAN máy tính của bạn (VD: `http://192.168.1.x:3000`).
