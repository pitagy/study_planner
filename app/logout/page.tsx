'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function LogoutPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  useEffect(() => {
    (async () => {
      await supabase.auth.signOut().catch(() => {});
      router.replace('/login');
      router.refresh();
    })();
  }, [router, supabase]);

  return <p className="p-4">로그아웃 중…</p>;
}
