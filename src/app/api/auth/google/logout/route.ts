import { NextResponse } from 'next/server';
import { clearServerSession } from '@/lib/auth/server-session';

export async function POST() {
  try {
    await clearServerSession();
    return NextResponse.json({ success: true, message: 'Đã đăng xuất thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
