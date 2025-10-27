// lib/supabase/browser.ts
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    client = createBrowserClient(url, anon, {
      auth: {
        persistSession: true,
        // 현재 설정: 탭/브라우저 종료 시 세션 삭제
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,

        // ↘↘↘ 영속 로그인 원하면 아래 한 줄로 교체 (그리고 위 줄은 삭제)
        // storage: typeof window !== 'undefined' ? window.localStorage : undefined,

        autoRefreshToken: true,
      },
    });
  }
  return client;
}
