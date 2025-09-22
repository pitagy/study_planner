// lib/supabaseClient.ts

// ✅ 클라이언트는 아래 함수만 쓰게 유지
export { getSupabaseBrowser } from './supabase/browser';

// ❌ 아래 줄이 있으면 삭제하세요 (server.ts가 클라이언트 번들로 섞여 들어갑니다)
// export { getSupabaseServer } from './supabase/server';

// ─ 하위 호환(기존 코드에서 supabase/getSupabaseClient를 썼다면)
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowser } from './supabase/browser';

export const supabase: SupabaseClient = getSupabaseBrowser();
export function getSupabaseClient(): SupabaseClient {
  return getSupabaseBrowser();
}
