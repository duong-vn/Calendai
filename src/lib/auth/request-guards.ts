import { NextResponse } from 'next/server';

const JSON_CONTENT_TYPE = /^application\/json(?:\s*;|$)/i;

/**
 * Rejects requests whose Content-Type is not application/json with HTTP 415.
 */
export function requireJsonContentType(request: Request): NextResponse | null {
  const contentType = request.headers.get('content-type')?.trim() ?? '';
  if (!JSON_CONTENT_TYPE.test(contentType)) {
    return NextResponse.json(
      { success: false, error: 'Yêu cầu phải sử dụng dữ liệu JSON.' },
      { status: 415 }
    );
  }
  return null;
}

/**
 * Blocks cross-site and cross-origin browser requests (including sibling subdomains
 * under SameSite=Lax cookies) while allowing native Bearer clients without Origin.
 */
export function requireSameOrigin(
  request: Request,
  errorMessage = 'Nguồn yêu cầu không hợp lệ.',
  headers?: HeadersInit
): NextResponse | null {
  const secFetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  const origin = request.headers.get('origin');
  if (
    secFetchSite === 'cross-site' ||
    secFetchSite === 'same-site' ||
    (origin !== null && origin.trim() !== new URL(request.url).origin)
  ) {
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 403, ...(headers ? { headers } : {}) }
    );
  }
  return null;
}
