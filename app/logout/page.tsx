'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function LogoutPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) 클라이언트 세션/스토리지 정리
        await supabase.auth.signOut();
      } catch {}

      try {
        // 2) 서버 쿠키 동기화(삭제)
        await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'SIGNED_OUT', session: null }),
        });
      } catch {}

      // 3) 로그인 화면으로 이동
      if (!cancelled) {
        router.replace('/login');
        router.refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  return <p className="p-4">로그아웃 중…</p>;
}
