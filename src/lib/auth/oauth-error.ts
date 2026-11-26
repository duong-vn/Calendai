export const GOOGLE_OAUTH_MESSAGES = {
  networkUnavailable: 'Không thể kết nối Google. Vui lòng thử lại sau.',
  reauthorizationRequired:
    'Mã đăng nhập hoặc quyền truy cập Google đã hết hiệu lực. Vui lòng đăng nhập lại.',
  authUnavailable: 'Google chưa thể xác thực tài khoản. Vui lòng thử lại sau.',
  invalidTokenResponse: 'Phản hồi xác thực Google không hợp lệ. Vui lòng thử lại.',
  userinfoFailed: 'Không thể xác minh thông tin tài khoản Google. Vui lòng đăng nhập lại.',
  profileInvalid: 'Thông tin tài khoản Google chưa được xác minh hoặc không hợp lệ.',
  calendarPermissionRequired:
    'Vui lòng cấp quyền quản lý sự kiện Google Calendar rồi đăng nhập lại.',
  consentRequired:
    'Google chưa cấp quyền truy cập ngoại tuyến. Vui lòng cấp lại quyền Google rồi đăng nhập lại.',
} as const;

export const OAUTH_ERROR_MESSAGES = {
  google_not_configured:
    'Chức năng kết nối Google Calendar chưa được cấu hình trên máy chủ.',
  access_denied: 'Bạn đã từ chối cấp quyền kết nối Google Calendar.',
  oauth_denied: 'Google từ chối ủy quyền đăng nhập. Vui lòng thử lại.',
  missing_oauth_params:
    'Thiếu mã xác thực hoặc trạng thái bảo mật từ phản hồi của Google. Vui lòng thử lại.',
  csrf_mismatch: 'Lỗi bảo mật CSRF: State không khớp hoặc đã hết hạn. Vui lòng thử lại.',
  oauth_init_failed: 'Không thể khởi tạo đăng nhập Google lúc này. Vui lòng thử lại sau.',
  oauth_failed: 'Xác thực Google thất bại. Vui lòng thử lại sau.',
  google_unavailable: GOOGLE_OAUTH_MESSAGES.networkUnavailable,
  google_reauthorization_required: GOOGLE_OAUTH_MESSAGES.reauthorizationRequired,
  google_profile_invalid: GOOGLE_OAUTH_MESSAGES.profileInvalid,
  google_calendar_permission_required: GOOGLE_OAUTH_MESSAGES.calendarPermissionRequired,
  google_consent_required: GOOGLE_OAUTH_MESSAGES.consentRequired,
} as const;

type OAuthErrorCode = keyof typeof OAUTH_ERROR_MESSAGES;

const ALLOWED_OAUTH_ERROR_MESSAGES = new Set<string>([
  ...Object.values(GOOGLE_OAUTH_MESSAGES),
  ...Object.values(OAUTH_ERROR_MESSAGES),
  'Thiếu authorization code hoặc state từ phản hồi của Google.',
]);

export function sanitizeGoogleCallbackErrorParam(errorParam: string): string {
  if (errorParam.trim() === 'access_denied') {
    return OAUTH_ERROR_MESSAGES.access_denied;
  }
  return OAUTH_ERROR_MESSAGES.oauth_denied;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function resolveOAuthErrorMessage(rawAuthError: string): string {
  const candidates = [rawAuthError.trim(), safeDecodeURIComponent(rawAuthError).trim()];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (Object.hasOwn(OAUTH_ERROR_MESSAGES, candidate)) {
      return OAUTH_ERROR_MESSAGES[candidate as OAuthErrorCode];
    }
    if (ALLOWED_OAUTH_ERROR_MESSAGES.has(candidate)) {
      return candidate;
    }
  }
  return OAUTH_ERROR_MESSAGES.oauth_failed;
}
