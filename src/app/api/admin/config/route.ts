import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  fetchProviderModelIds,
  getAdminModelConfig,
  ProviderCatalogError,
  saveAdminModelConfig,
} from '@/lib/ai/admin-config';
import { isAdminSession } from '@/lib/auth/admin';
import { requireJsonContentType, requireSameOrigin } from '@/lib/auth/request-guards';
import { getServerSession } from '@/lib/auth/server-session';

export const dynamic = 'force-dynamic';

const UpdateAdminConfigSchema = z.object({
  primaryModel: z.string().trim().min(1, 'Vui lòng chọn model chính.').max(200),
  fallbackModel: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

async function resolveAdminSession(request: Request) {
  try {
    const session = await getServerSession(request);
    return isAdminSession(session) ? session : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const adminSession = await resolveAdminSession(request);
  if (!adminSession) {
    return NextResponse.json(
      { error: 'Bạn không có quyền truy cập trang quản trị.', isAdmin: false },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const config = getAdminModelConfig();
    return NextResponse.json(
      {
        primaryModel: config.primaryModel,
        fallbackModel: config.fallbackModel,
        isAdmin: true,
        ...(config.updatedAt ? { updatedAt: config.updatedAt } : {}),
        ...(config.updatedBy ? { updatedBy: config.updatedBy } : {}),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { error: 'Máy chủ chưa được cấu hình AI đầy đủ.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: Request) {
  const contentTypeError = requireJsonContentType(request);
  if (contentTypeError) return contentTypeError;

  const originError = requireSameOrigin(request, 'Nguồn yêu cầu quản trị không hợp lệ.', {
    'Cache-Control': 'no-store',
  });
  if (originError) return originError;

  const adminSession = await resolveAdminSession(request);
  if (!adminSession) {
    return NextResponse.json(
      { error: 'Bạn không có quyền thay đổi cấu hình quản trị.', isAdmin: false },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Yêu cầu JSON không hợp lệ.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const parsed = UpdateAdminConfigSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Thông tin cấu hình model không hợp lệ.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { primaryModel, fallbackModel } = parsed.data;
  if (fallbackModel && fallbackModel === primaryModel) {
    return NextResponse.json(
      { error: 'Model chính và model dự phòng không được trùng nhau.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let allowedModelIds: Set<string>;
  try {
    allowedModelIds = await fetchProviderModelIds(request.signal);
  } catch (error) {
    if (error instanceof ProviderCatalogError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: 'Không thể kiểm tra danh sách model từ nhà cung cấp AI. Vui lòng thử lại sau.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (!allowedModelIds.has(primaryModel)) {
    return NextResponse.json(
      { error: 'Model chính không nằm trong danh sách được nhà cung cấp hỗ trợ.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (fallbackModel && !allowedModelIds.has(fallbackModel)) {
    return NextResponse.json(
      { error: 'Model dự phòng không nằm trong danh sách được nhà cung cấp hỗ trợ.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const saved = saveAdminModelConfig({
      primaryModel,
      fallbackModel,
      updatedBy: adminSession.user.email,
    });

    return NextResponse.json(
      {
        success: true,
        primaryModel: saved.primaryModel,
        fallbackModel: saved.fallbackModel,
        isAdmin: true,
        ...(saved.updatedAt ? { updatedAt: saved.updatedAt } : {}),
        ...(saved.updatedBy ? { updatedBy: saved.updatedBy } : {}),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { error: 'Không thể lưu cấu hình model trên máy chủ. Vui lòng thử lại.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
