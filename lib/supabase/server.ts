// lib/supabase/server.ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/** 서버 컴포넌트/Route용 Supabase 클라이언트 생성기 */
export function getSupabaseServer(): SupabaseClient {
  const cookieStore = cookies();
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // RSC에선 set/remove가 제한될 수 있으니 try/catch로 no-op 처리
      set(name: string, value: string, options: any) {
        try { cookieStore.set({ name, value, ...options }); } catch {}
      },
      remove(name: string, options: any) {
        try { cookieStore.set({ name, value: '', ...options, expires: new Date(0) }); } catch {}
      },
    },
  });
}

/** 과거 이름 호환용 별칭: 둘 다 사용 가능하게 */
export const getServerSupabase = getSupabaseServer;
