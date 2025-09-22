// lib/supabase/server.ts
import 'server-only'; // ✅ 서버 전용 강제

import { cookies } from 'next/headers';
import { createServerClient, type SupabaseClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export function getSupabaseServer(): SupabaseClient<Database> {
  const cookieStore = cookies();
  // 매 요청마다 새 클라이언트를 만들어도 OK (쿠키 컨텍스트가 요청 단위라서)
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}
