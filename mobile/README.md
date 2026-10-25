# Calendai Mobile — Expo SDK 52

Ứng dụng native chat-first, cùng bảng màu giấy/đồng/teal và giao diện sáng/tối của web. Google Sign-In thực, phiên JWE trong SecureStore, AI SDK `4.3.19` `useChat` qua `expo/fetch`, thẻ bản thảo/xác nhận Calendar, lịch sắp tới, Markdown và nhập giọng nói tiếng Việt. Không WebView, Redis, dữ liệu mẫu hoặc tự tạo lịch từ lời nói.

## Cấu hình công khai bắt buộc

Thiết lập bằng dashboard EAS Environment Variables hoặc môi trường shell/build; không đưa khóa bí mật vào app, mã nguồn hay APK.

| Tên | Giá trị |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | HTTPS origin backend, mặc định `https://calendai.tduong.online`, không thêm `/api`, query, user/password hoặc đường dẫn |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | OAuth client **Web application** của cùng backend, dạng `….apps.googleusercontent.com` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | OAuth client **iOS**, bắt buộc khi build iOS; Android không cần biến này |

Đây là client ID công khai, không phải client secret. Thiếu Web client ID sẽ hiển thị lỗi cấu hình rõ khi đăng nhập. App không chuyển sang fake login. `app.config.js` tự tạo URL scheme iOS đảo từ iOS client ID; build iOS trên EAS bị chặn nếu thiếu ID. Android dùng autolinking của Google SDK, không cần Firebase hay `google-services.json`. Plugin Google Sign-In không-Firebase chỉ cần thêm khi cấu hình callback iOS có thật.

### Google Cloud / Android SHA-1

1. Bật Google Calendar API trong Google Cloud project chứa OAuth clients của backend.
2. Cấu hình consent screen, thông tin privacy/terms và test users nếu ứng dụng đang ở chế độ Testing. Cho phép `calendar.events` và `calendar.readonly` cùng quyền profile/email.
3. Tạo Web client và đặt **cùng Web client ID** cho backend và `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
4. Tạo OAuth Android client với package **`com.calendai.mobile`** và SHA-1 của chứng chỉ ký **đúng bản build**. Debug keystore, EAS APK/internal, và Play App Signing có thể có SHA-1 khác nhau; đăng ký từng chứng chỉ cần dùng. Lấy SHA-1 từ cấu hình ký EAS/Google Play Console hoặc keystore do bạn quản lý; không gửi keystore/password qua chat hay ghi vào repo.
5. Nếu iOS: tạo client cho bundle **`com.calendai.mobile`**, đặt `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` rồi build lại để plugin thêm scheme.
6. Backend quản lý `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` và cấu hình AI trên server. Không đặt chúng dưới bất kỳ tên `EXPO_PUBLIC_*` nào. Backend phải triển khai mobile endpoints trước khi thử app.

SDK gọi `offlineAccess: true`, `forceCodeForRefreshToken: true` và yêu cầu các scope Calendar. Chỉ **server authorization code một lần** được gửi backend qua HTTPS; app không gửi danh tính SDK lên để tự xác thực, không dùng ID-token-only và không nhận Google access/refresh token dạng rõ. Nếu Google không cấp refresh token hoặc quyền bị từ chối, đăng nhập phải được thực hiện lại với consent phù hợp. Google OAuth Testing có thể giới hạn refresh grant (thường 7 ngày với scope Calendar); cấu hình Cloud/publishing cần hoàn tất cho production.

## Backend contract

- `POST /api/auth/mobile/exchange` JSON `{ "code": "…" }` → `{ session, user: { id, email, name?, picture? }, expiresAt, accessTokenExpiresAt }`.
- `POST /api/auth/mobile/refresh`, `Authorization: Bearer <session>` → cùng response; giữ thời hạn tuyệt đối `expiresAt`, không đổi tài khoản.
- Expiry là epoch milliseconds (client cũng đọc ISO). `user.id` là Google subject ổn định do backend xác minh.
- `GET /api/auth/google/status`, `POST /api/chat`, `GET /api/calendar/upcoming`, `POST /api/calendar/confirm` chấp nhận Bearer; Bearer sai/hết hạn không được fallback sang cookie/anonymous/mock.
- `GET /api/models` cung cấp `{ models, defaultModel }`; không hardcode model trong client.
- Chat dùng **AI SDK v4 data-stream protocol**, không nâng một phía và không tự parse stream. `maxSteps: 5`; hỗ trợ tool `proposeMeeting`, `listUpcomingEvents` và abort.
- Bản thảo chuẩn: `proposalId/summary/startDateTime/endDateTime/timeZone/attendees/createMeet/description`. Event: `id/summary/start/end/hangoutLink?/htmlLink?/conferenceStatus?`.
- Confirm chỉ chạy sau khi bấm nút; client lưu chính xác payload trước request và đóng băng sau lần gửi đầu. Retry cùng `proposalId` + cùng payload; chỉnh sửa yêu cầu AI tạo bản thảo **mới**. Backend chịu trách nhiệm idempotency theo account + proposalId. Calendar success không đồng nghĩa link Meet đã sẵn sàng.
- `401` với `code: SESSION_REFRESH_REQUIRED` chỉ được trả **trước side effects**, cho phép refresh và retry một lần. `401` khác buộc đăng nhập lại; lỗi mạng/5xx không xóa phiên. Refresh single-flight trước Google expiry 90 giây, JWE mới luôn ghi SecureStore trước khi dùng.

## Vì sao có native patch Expo

`expo@52.0.49` không hỗ trợ `RequestInit.redirect`. Source native mặc định tự theo redirect, nên chỉ kiểm tra URL response sau fetch **không đủ** để bảo vệ code/Bearer. `patches/expo+52.0.49.patch` tắt redirect của `expo/fetch` trên cả Android OkHttp và iOS URLSession, không đụng fetch React Native khác. `postinstall` áp patch và fail nếu patch không áp được. Transport chỉ gọi HTTPS origin đã cấu hình, bỏ cookies và từ chối redirect.

**Phải build native lại** sau thay đổi này; OTA JavaScript hoặc Expo Go không áp được patch. Không bỏ postinstall/patch. Đây là giới hạn version được pin, không phải cơ chế OAuth tự viết. Khi nâng Expo, kiểm tra upstream hỗ trợ redirect/no-leak trước khi bỏ hoặc cập nhật patch. Mọi redirect API, kể cả same-origin, đều được từ chối; backend phải trả trực tiếp từ canonical origin.

## Dependencies và giới hạn có chủ ý

- Google Sign-In `13.2.0`: maintained package, peer Expo >=50, native Google SDK, serverAuthCode/offline access; không có API tương đương trong React Native stdlib. API Android Original dựa trên Google Sign-In cũ vẫn hoạt động nhưng SDK upstream đã deprecated; không tự đổi sang một auth primitive hoặc ID-token-only. Nâng khi gói hỗ trợ Expo52-compatible thay thế đủ server code + Calendar scopes.
- `expo-secure-store@14.0.1`: Keychain/Keystore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; AsyncStorage không phù hợp cho JWE. SecureStore chỉ chứa session + profile/expiry phục vụ restore, không chứa lịch sử chat.
- AsyncStorage `1.23.1`: lịch sử/preferences theo **origin + user.id**, guest riêng; index hiển thị tối đa 50 hội thoại. Nội dung v2 lưu riêng từng phiên, chỉ tải phiên được chọn và ghi phiên thay đổi. Lần đầu chuyển v1 sang v2 giữ nguyên bản v1 để khôi phục; nội dung ngoài index chưa tự dọn nên 50 phiên không phải giới hạn dung lượng. Lưu trên thiết bị, không đồng bộ web và không mã hóa nội dung chat. Xóa chat hiện bỏ khỏi index, không xóa Calendar event; chưa phải xóa an toàn toàn bộ bản sao cục bộ.
- `expo-speech-recognition@1.1.1`: dòng hỗ trợ Expo52 chính thức (v2 trở lên dành SDK53+), native permissions/engine; không cài voice library cũ không hỗ trợ SDK. Mic chỉ bắt đầu sau tap, xin quyền lúc dùng, đổ vào draft không tự gửi. Dừng/hủy khi background, mở sheet/chuyển chat, logout, unmount. Không đảm bảo offline hoặc engine tiếng Việt trên mọi thiết bị.
- `@ronradtke/react-native-markdown-display@9.0.3`: maintained fork renderer native (không WebView), HTTPS links được kiểm tra, không tải ảnh Markdown từ xa; renderer không thực thi HTML/JS.
- Safe-area-context `4.12.0`, Expo Clipboard `7.0.1`, Expo Font `13.0.4` và Plus Jakarta Sans `0.4.2`: insets/copy link/font local có dấu tiếng Việt; stdlib không cung cấp các native integrations này. UI giữ native font scaling, keyboard resize/avoidance và nút chạm ≥46dp.
- `ai@4.3.19` và custom `expo/fetch`: reuse protocol backend. `metro.config.cjs` bật package exports để SDK52 resolve `ai/react`; không thêm parser hoặc stream polyfill.
- `jest-expo@52.0.6`, renderer React18: chỉ dev tests; patch-package chỉ phục vụ native redirect guard. Không nâng Expo/React ngoài SDK52.

Logout xóa SecureStore và phiên SDK trên **thiết bị này**, hủy UI cũ và tách dữ liệu tài khoản. JWE stateless không hỗ trợ thu hồi phiên đã bị sao chép hoặc logout tất cả thiết bị. Không log code/JWE/profile/provider payload. Không có secret trong app public config.

## Chạy / build

Từ thư mục `mobile/` (dependency tree tách khỏi Next.js root):

```sh
npm ci
npm run typecheck
npm test
npx expo-doctor
npx expo export --platform android --output-dir dist-android
npm run android
```

Google Sign-In/speech **không chạy trong Expo Go**. Dùng development build (`npm run android`, macOS cho iOS) hoặc EAS profile development. Sau khi cấu hình client IDs và chứng chỉ đúng:

```sh
npx eas-cli build -p android --profile preview
```

Profile preview xuất APK release cài trực tiếp, không dùng dev client và không cần Metro; versionCode tự tăng theo EAS remote version. Profile này lấy biến từ EAS environment `preview`. Trước khi build:

1. Đặt `EXPO_PUBLIC_API_URL` và `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` trong EAS environment `preview`. Đây là cấu hình công khai; không đưa khóa AI, Google client secret hoặc session secret vào app. Không dựa vào file môi trường cục bộ để cấu hình cloud build.
2. Đăng ký OAuth Android client với package `com.calendai.mobile` và SHA-1 của chứng chỉ ký APK EAS. SHA-1 debug trên máy ảo có thể khác bản APK này.
3. Nếu cập nhật bản đã cài, dùng cùng khóa ký. Nếu Android báo chữ ký không khớp, không gỡ bản cũ khi chưa bảo toàn dữ liệu; gỡ app sẽ xóa lịch sử cục bộ.
4. Chạy lệnh build ở trên từ `mobile/`, tải APK từ liên kết EAS trả về và cho phép cài ứng dụng từ nguồn đó trên điện thoại. Không chọn profile development cho bản dùng độc lập.
5. Sau cài đặt: đăng nhập, gửi tin nhắn, thử mic, tạo một lịch thử sau khi kiểm tra bản thảo, rồi đóng/mở lại app để kiểm tra phiên và lịch sử.

Cloud build sẽ dừng sớm nếu thiếu Web client ID hoặc API origin không hợp lệ. Khi mở Metro cho development, dừng bằng Ctrl+C sau khi dùng; không để server tạm chạy ngầm.

## Kiểm chứng thực tế

Automated tests bao phủ SecureStore restore/logout, code exchange, refresh single-flight/stale account/network/401, account-isolated history/serialized writes, schema/link safety, real-vs-mock Calendar, conference pending/failure, explicit confirmation/double tap/unmount abort và voice permission/background/draft-only.

**JS export/typecheck/test không chứng minh đăng nhập native hoặc Hermes streaming trên máy thật.** Chưa có thiết bị và Google Cloud client/SHA-1 cấu hình thì đây là blocker external cần báo rõ, không pretend end-to-end đã thành công. Checklist trên development/release device:

1. Login, cancel, consent Calendar, thiếu quyền; reopen và restore; đổi tài khoản không thấy chat cũ.
2. Chat streaming tiếng Việt, multi-step/tool results, stop; mạng gián đoạn/retry, hết Google access expiry/single-flight.
3. Preview đúng timezone/khách; bấm xác nhận một sự kiện được phép tạo; retry timeout không trùng; Calendar success/Meet pending riêng.
4. Mic permission denied, tiếng Việt, edit draft, background/chuyển chat/logout trong permission prompt, không tự gửi.
5. Bàn phím, safe area, font lớn, light/dark, màn hình phone/tablet và xoay màn hình.
6. Endpoint test có redirect phải bị chặn **trước** request tới đích; cả Android/iOS native build.
7. Offline không biến thành “lịch trống”; logout xóa phiên và không cho callback cũ ghi sang tài khoản mới.

Nguồn chính: [Google Sign-In original API](https://react-native-google-signin.github.io/docs/original), [Expo integration](https://react-native-google-signin.github.io/docs/setting-up/expo), [speech SDK52 changelog](https://github.com/jamsch/expo-speech-recognition/blob/main/CHANGELOG.md). Native compatibility cũng được kiểm tra từ source/types đã pin; mọi smoke chưa thực hiện trên thiết bị phải ghi là chưa xác minh.
