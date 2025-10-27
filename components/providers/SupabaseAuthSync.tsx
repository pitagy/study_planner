'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function SupabaseAuthSync() {
  // ✅ Supabase 클라이언트 직접 생성
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // ✅ 로그인/로그아웃 등 인증 상태 변화 감지
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // ✅ 서버에 인증 세션 전달 (Next.js API route 등)
        await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, session }),
        });
      }
    );

    // ✅ 컴포넌트 언마운트 시 구독 해제
    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  // ✅ 렌더링할 내용 없음 (단순 동기화 역할)
  return null;
}
