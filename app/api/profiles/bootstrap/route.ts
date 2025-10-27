// app/api/profiles/bootstrap/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // 서버 전용 환경변수
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'missing Bearer token' }, { status: 401 });
  }

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 });
  }

  const uid = userData.user.id;
  const email = userData.user.email ?? undefined;

  const body = await req.json().catch(() => ({}));
  const payload = {
    id: uid,
    email: body.email ?? email ?? null,
    role: 'student',
    approved: false,
    center_name: body.centerName ?? null,
    student_name: body.studentName ?? null,
    seat_no: body.seatNo ?? null,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  // 이미 있으면 건너뜀
  const { error } = await admin
    .from('profiles')
    .upsert(payload, { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
