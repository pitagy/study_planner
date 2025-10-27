import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function PostLogin() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {}
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {}
        },
      },
    }
  );

  // ✅ 로그인 유저 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // ✅ 프로필 정보 가져오기
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || !profile?.role) {
    redirect('/student'); // 기본 경로
  }

  console.log('🔍 로그인 성공 | role:', profile.role);

  // ✅ 역할별 페이지 분기
  if (profile.role === 'admin') {
    redirect('/admin');
  } else if (profile.role === 'teacher') {
    redirect('/teacher');
  } else if (profile.role === 'parent') {
    redirect('/parent'); // ✅ 누락되었던 부분 추가
  } else {
    redirect('/student');
  }

  return null;
}
