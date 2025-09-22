'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Role = 'student' | 'teacher' | 'admin';

export default function UserTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<Role>('student');

  const here = (p: string) => pathname?.startsWith(p);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      const em = s.session?.user.email ?? '';
      setEmail(em ?? '');
      if (!uid) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .maybeSingle();

      const r = (prof?.role ?? 'student') as Role;
      setRole(r);
    })();
  }, [supabase]);

  // 자주 가는 경로는 미리 prefetch
  useEffect(() => {
    router.prefetch('/student');
    router.prefetch('/student/dashboard');
    router.prefetch('/teacher');
    router.prefetch('/admin');
  }, [router]);

  // 경로별 네비게이션 모드 결정
  const mode: 'student' | 'teacher' | 'admin' =
    here('/admin') ? 'admin' : here('/teacher') ? 'teacher' : 'student';

  const NavButton = ({
    href,
    label,
    active,
  }: {
    href: string;
    label: string;
    active?: boolean;
  }) => (
    <Link
      href={href}
      onMouseEnter={() => router.prefetch(href)}
      className={`rounded-full px-3 py-1.5 text-sm border ${
        active ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur border-b">
      <div className="mx-auto max-w-6xl px-4 h-12 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NavButton href="/student" label="학습 플래너" active={here('/student') && mode==='student'} />
          {mode === 'student' && (
            <>
              <NavButton
                href="/student"
                label="플래너"
                active={here('/student') && !here('/student/dashboard')}
              />
              <NavButton
                href="/student/dashboard"
                label="대시보드"
                active={here('/student/dashboard')}
              />
            </>
          )}
          {mode === 'teacher' && (
            <NavButton href="/teacher" label="선생님 페이지" active={here('/teacher')} />
          )}
          {mode === 'admin' && (
            <NavButton href="/admin" label="관리자 페이지" active={here('/admin')} />
          )}
        </div>

        <div className="flex items-center gap-2">
          {!!email && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
              {role} · {email}
            </span>
          )}
          <Link
            href="/logout"
            className="rounded-full bg-black text-white px-3 py-1 text-sm"
          >
            로그아웃
          </Link>
        </div>
      </div>
    </header>
  );
}
