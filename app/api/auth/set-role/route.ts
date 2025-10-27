// app/api/auth/set-role/route.ts
import { NextResponse, NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { role } = await req.json();
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return NextResponse.json({ ok: false, error: 'invalid role' }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });
    // httpOnly=false: 미들웨어에서 읽을 필요 없고, 클라이언트에서 존재여부만 체크 용도
    res.cookies.set('x-role', role, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
    });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('x-role', '', { path: '/', maxAge: 0 });
  return res;
}
