import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 서버에서만 쓰는 Service Role 키 (RLS 우회)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // <-- 꼭 .env.local 에 넣어주세요
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { uid, email, center_name, student_name, seat_no } = body || {};

    if (!uid || !email || !center_name || !student_name) {
      return NextResponse.json({ message: 'missing fields' }, { status: 400 });
    }

    // profiles 스키마에 맞춰 조정하세요.
    // id: uuid (auth.users.id), email, center_name, student_name, seat_no, role, approved 등
    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: uid,
          email,
          center_name,
          student_name,
          seat_no,
          role: 'student',
          approved: true,
        },
        { onConflict: 'id' }
      );

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message ?? 'unknown' }, { status: 500 });
  }
}
