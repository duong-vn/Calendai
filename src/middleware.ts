import { NextResponse, type NextRequest } from 'next/server';
import { isAdminSession } from '@/lib/auth/admin';
import { decryptSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { getSessionSecret } from '@/lib/env';

const FORBIDDEN_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>403 — Không có quyền truy cập | Calendai</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f5eee1;color:#2b1f17;margin:0;padding:24px;display:flex;min-height:100vh;align-items:center;justify-content:center;">
  <main style="max-width:480px;background:#fffaf2;border:2px solid #2d2015;border-radius:20px;padding:32px;box-shadow:4px 4px 0 #2d2015;text-align:center;">
    <h1 style="margin:0 0 12px;font-size:24px;">403 — Không có quyền truy cập</h1>
    <p style="margin:0 0 24px;line-height:1.5;color:#5a4638;">Trang quản trị chỉ dành cho tài khoản quản trị viên được cấu hình trên máy chủ.</p>
    <a href="/" style="display:inline-block;padding:10px 18px;border-radius:12px;border:2px solid #2d2015;background:#c25e2e;color:#fff;font-weight:700;text-decoration:none;">Quay về trang chủ</a>
  </main>
</body>
</html>`;

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session = null;

  if (token) {
    try {
      session = await decryptSession(token, getSessionSecret());
    } catch {
      session = null;
    }
  }

  if (!isAdminSession(session)) {
    return new NextResponse(FORBIDDEN_HTML, {
      status: 403,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
