import { z } from 'zod';
import { getServerEnv } from '../env';
import { authErrorResponse } from './server-session';
import { encryptMobileSession } from './session';
import type { MobileSessionData } from './types';

const ExchangeRequestSchema = z.object({ code: z.string().trim().min(1).max(4096) }).strict();
const MAX_EXCHANGE_BYTES = 8192;

export class MobileRequestError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export async function readMobileExchangeCode(request: Request): Promise<string> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new MobileRequestError('Yêu cầu phải dùng định dạng JSON.', 415);
  }
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_EXCHANGE_BYTES)) {
    throw new MobileRequestError('Yêu cầu đăng nhập quá lớn.', 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new MobileRequestError('Thiếu mã đăng nhập Google.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_EXCHANGE_BYTES) {
        await reader.cancel();
        throw new MobileRequestError('Yêu cầu đăng nhập quá lớn.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new MobileRequestError('Dữ liệu đăng nhập không hợp lệ.');
  }
  const parsed = ExchangeRequestSchema.safeParse(body);
  if (!parsed.success) throw new MobileRequestError('Mã đăng nhập Google không hợp lệ.');
  return parsed.data.code;
}

export async function mobileSessionResponse(session: MobileSessionData): Promise<Response> {
  const env = getServerEnv();
  return Response.json({
    session: await encryptMobileSession(session, env.SESSION_SECRET),
    user: session.user,
    expiresAt: session.expiresAt,
    accessTokenExpiresAt: session.tokens.expiresAt,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export function mobileErrorResponse(error: unknown): Response {
  const authResponse = authErrorResponse(error);
  if (authResponse) return authResponse;
  return Response.json({
    error: error instanceof MobileRequestError ? error.message : 'Không thể xác thực lúc này. Vui lòng thử lại sau.',
  }, {
    status: error instanceof MobileRequestError ? error.status : 500,
    headers: { 'Cache-Control': 'no-store' },
  });
}
