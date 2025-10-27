// lib/useUser.ts

'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  role?: 'student' | 'teacher' | 'admin' | string | null;
  approved?: boolean | null;
};

export function useUser() {
  const [user, setUser] = useState<ReturnType<typeof supabase.auth.getUser> extends Promise<infer R> ? R extends { data: { user: infer U } } ? U : null : null>(null as any);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      const u = data.user ?? null;
      if (!mounted) return;
      setUser(u);

      if (u?.id) {
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', u.id)
          .maybeSingle();
        if (mounted) setProfile((p as any) ?? null);
      }
      if (mounted) setLoading(false);
    }

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      await bootstrap();
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return useMemo(() => ({ user, profile, loading }), [user, profile, loading]);
}
