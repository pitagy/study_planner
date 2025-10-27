// app/providers/AuthListener.tsx
'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// 브라우저 전용 supabase 클라이언트 (localStorage 기반, 쿠키 X)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

export default function AuthListener() {
  // 중복 구독 방지
  const attached = useRef(false);

  useEffect(() => {
    if (attached.current) return;
    attached.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // 서버 세션과 동기화 (SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED / USER_UPDATED)
        try {
          await fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, session }),
          });
        } catch {
          // 네트워크 에러는 무시
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
