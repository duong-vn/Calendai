import { getValidAccessToken } from '@/lib/auth/server-session';
import type { SessionData } from '@/lib/auth/types';

const GOOGLE_CALENDAR_PERMISSION_REASONS = new Set([
  'insufficientPermissions',
  'authError',
  'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
]);

const GOOGLE_CALENDAR_RATE_LIMIT_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'quotaExceeded',
  'dailyLimitExceeded',
  'calendarUsageLimitsExceeded',
]);

export class CalendarUnauthorizedError extends Error {
  constructor() {
    super('Quyền truy cập Google Calendar đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại tài khoản Google.');
    this.name = 'CalendarUnauthorizedError';
  }
}

export class CalendarPermissionError extends Error {
  readonly code = 'google_calendar_permission_required' as const;
  readonly status = 403 as const;

  constructor() {
    super('Chưa đủ quyền quản lý sự kiện Google Calendar. Vui lòng kết nối lại tài khoản Google và cấp quyền.');
    this.name = 'CalendarPermissionError';
  }
}

export function isGoogleCalendarPermissionError(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return false;
  const errorObj = (payload as { error?: unknown }).error;
  if (!errorObj || typeof errorObj !== 'object') return false;

  const reasons: string[] = [];
  const collectReasons = (items: unknown) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item && typeof item === 'object' && 'reason' in item && typeof (item as { reason?: unknown }).reason === 'string') {
        reasons.push((item as { reason: string }).reason);
      }
    }
  };

  collectReasons((errorObj as { errors?: unknown }).errors);
  collectReasons((errorObj as { details?: unknown }).details);

  if (reasons.some((reason) => GOOGLE_CALENDAR_RATE_LIMIT_REASONS.has(reason))) {
    return false;
  }
  return reasons.some((reason) => GOOGLE_CALENDAR_PERMISSION_REASONS.has(reason));
}

export async function isCalendarPermissionResponse(response: Response): Promise<boolean> {
  if (response.status !== 403) return false;
  try {
    return isGoogleCalendarPermissionError(await response.json());
  } catch {
    return false;
  }
}

export function calendarPermissionResponse(): Response {
  return Response.json(
    {
      success: false,
      error: 'Chưa đủ quyền quản lý sự kiện Google Calendar. Vui lòng kết nối lại tài khoản Google và cấp quyền.',
      code: 'google_calendar_permission_required',
    },
    {
      status: 403,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export function isBearerSessionRequest(session: SessionData | null, request?: Request): boolean {
  return session?.kind === 'mobile' || Boolean(request?.headers.has('authorization'));
}

export function calendarUnauthorizedResponse(session: SessionData | null, request?: Request): Response {
  const isBearer = isBearerSessionRequest(session, request);
  const code = isBearer ? 'SESSION_REFRESH_REQUIRED' : 'google_reauthorization_required';
  const error = isBearer
    ? 'Vui lòng làm mới phiên đăng nhập trước khi tiếp tục.'
    : 'Quyền truy cập Google Calendar đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại tài khoản Google.';

  return Response.json(
    { success: false, error, code },
    {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
        'WWW-Authenticate': 'Bearer',
      },
    }
  );
}

/**
 * Runs a pre-mutation-safe Google Calendar operation with a valid access token.
 * On HTTP 401 from Google Calendar, Bearer mobile requests fail immediately with
 * `CalendarUnauthorizedError` (mapped to `SESSION_REFRESH_REQUIRED`), while web
 * cookie sessions attempt one server-side token refresh before retrying once.
 */
export async function executeWithCalendarAuth<T>(
  session: SessionData,
  request: Request,
  operation: (accessToken: string) => Promise<T>
): Promise<T> {
  const { accessToken } = await getValidAccessToken(session, request);
  try {
    return await operation(accessToken);
  } catch (error) {
    if (!(error instanceof CalendarUnauthorizedError)) throw error;
    if (isBearerSessionRequest(session, request)) throw error;

    const refreshed = await getValidAccessToken(session, request, { forceRefresh: true });
    if (refreshed.accessToken === accessToken) throw error;
    return await operation(refreshed.accessToken);
  }
}
