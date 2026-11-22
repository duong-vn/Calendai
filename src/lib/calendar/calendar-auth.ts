import { getValidAccessToken } from '@/lib/auth/server-session';
import type { SessionData } from '@/lib/auth/types';

export class CalendarUnauthorizedError extends Error {
  constructor() {
    super('Quyền truy cập Google Calendar đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại tài khoản Google.');
    this.name = 'CalendarUnauthorizedError';
  }
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
