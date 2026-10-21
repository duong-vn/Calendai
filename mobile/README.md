# Calendai Mobile (Expo / React Native)

Giao diện Agenda Dashboard cho Calendai. Đây chưa phải ứng dụng có đầy đủ chức năng của web.

## Trạng thái tích hợp

- Đọc lịch qua `/api/calendar/upcoming` và trạng thái qua `/api/auth/google/status`.
- Chỉ hiển thị cuộc họp hôm nay theo múi giờ `Asia/Ho_Chi_Minh`.
- Không hiển thị dữ liệu mẫu hoặc báo thành công khi API thất bại.
- Luồng đăng nhập Google native, trò chuyện AI và nhận diện giọng nói native **chưa được tích hợp**. Đăng nhập trong trình duyệt không tự chia sẻ phiên với ứng dụng native.
- Giao diện xác nhận và hàm gọi `/api/calendar/confirm` được giữ lại, nhưng chưa có bản thảo thật từ AI trên mobile. Dùng web để đề xuất và xác nhận lịch.
- Có thể sử dụng nhập giọng nói từ bàn phím điện thoại; nút mic trong app chỉ thông báo giới hạn hiện tại.

## Chạy cục bộ

```bash
cd mobile
npm install
npm start
```

Đặt biến môi trường công khai `EXPO_PUBLIC_API_URL` thành URL backend trước khi khởi động hoặc build. Máy thật không truy cập được backend máy tính qua `localhost`; dùng địa chỉ LAN khi phát triển hoặc HTTPS public khi build APK. Biến này chỉ chứa URL công khai, không chứa thông tin xác thực.

## Build APK

```bash
npx eas-cli build -p android --profile preview
```

Cấu hình `preview` trong `eas.json` xuất APK cài trực tiếp. Build thành công không chứng minh chức năng đăng nhập/AI/giọng nói đã được tích hợp.
