// lib/auth/ensureValidSession.ts
'use client';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export async function ensureValidSession() {
  const supabase = getSupabaseBrowser();
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    // 세션 없으면 그대로 통과(비로그인 상태)
    return true;
  } catch {
    // 깨진 토큰/리프레시 → 강제 정리
    try { await supabase.auth.signOut(); } catch {}
    try {
      localStorage.removeItem('supabase.auth.token');
      for (const k in localStorage) {
        if (k.startsWith('sb-') || k.startsWith('supabase')) localStorage.removeItem(k);
      }
    } catch {}
    if (typeof window !== 'undefined') window.location.replace('/login');
    return false;
  }
}
