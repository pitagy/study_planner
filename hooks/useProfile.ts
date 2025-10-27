// hooks/useProfile.ts
'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

export type Profile = {
  id: string;
  email: string;
  role: 'admin' | 'teacher' | 'student' | 'pending';
  approved: boolean | null;
  center_name: string | null;
};

export function useProfile() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (!session) { setLoading(false); return; }

        const { data, error } = await supabase
          .from('profiles')
          .select('id,email,role,approved,center_name')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) throw error;
        setProfile(data ?? null);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  return { loading, session, profile, error };
}
