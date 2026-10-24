import { fetch as expoFetch } from 'expo/fetch';

export function trustedOrigin(input: string): string {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Địa chỉ API phải là HTTPS origin, không có đường dẫn hoặc thông tin đăng nhập.');
  }
  return url.origin;
}

export const API_ORIGIN = trustedOrigin(process.env.EXPO_PUBLIC_API_URL || 'https://calendai.tduong.online');
export type Fetcher = typeof globalThis.fetch;

// Expo SDK 52 does not implement RequestInit.redirect. The checked-in native patch
// rejects redirects before the next request (including exchange codes and Bearer).
export const nativeFetch: Fetcher = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (new URL(url).origin !== API_ORIGIN || !url.startsWith(`${API_ORIGIN}/api/`)) {
    throw new Error('Đã chặn yêu cầu đến địa chỉ API không tin cậy.');
  }
  const response = await expoFetch(url, { ...init, body: init?.body ?? undefined, signal: init?.signal ?? undefined, credentials: 'omit' });
  if (response.status >= 300 && response.status < 400 || response.redirected || response.url && new URL(response.url).origin !== API_ORIGIN) {
    throw new Error('Máy chủ chuyển hướng yêu cầu. Vui lòng kiểm tra địa chỉ API chính thức.');
  }
  return response as unknown as Response;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

export async function readJson(response: Response): Promise<unknown> {
  let value: unknown;
  try { value = await response.json(); } catch { throw new ApiError('Máy chủ trả dữ liệu không hợp lệ. Vui lòng thử lại.', response.status); }
  if (!response.ok) {
    const code = typeof value === 'object' && value !== null && 'code' in value && typeof value.code === 'string' ? value.code : undefined;
    // Never display untrusted server bodies, which may contain auth material.
    const message = response.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      : response.status === 403 ? 'Chưa đủ quyền Google Calendar. Vui lòng đăng nhập lại và cấp quyền.'
      : response.status === 409 ? 'Bản thảo đã được gửi với nội dung khác. Hãy tạo bản thảo mới.'
      : response.status === 429 ? 'Bạn đang gửi quá nhanh. Vui lòng chờ một chút rồi thử lại.'
      : 'Không thể hoàn thành yêu cầu. Kiểm tra mạng rồi thử lại.';
    throw new ApiError(message, response.status, code);
  }
  return value;
}
