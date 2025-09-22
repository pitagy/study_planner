'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Role = 'student' | 'teacher' | 'admin';
let cachedSession: any | null = null; // 메모리 캐시

export default function RequireAuth({
  children,
  allow = ['student', 'teacher', 'admin'] as Role[],
}: {
  children: ReactNode;
  allow?: Role[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [ready, setReady] = useState(false);
  const didRedirect = useRef(false);

  useEffect(() => {
    (async () => {
      if (!cachedSession) {
        const { data } = await supabase.auth.getSession();
        cachedSession = data.session ?? null;
      }
      const session = cachedSession;
      if (!session) {
        if (!didRedirect.current) {
          didRedirect.current = true;
          router.replace('/login');
        }
        return;
      }

      const uid = session.user.id;
      const { data: prof } = await supabase
        .from('profiles')
        .select('role, approved')
        .eq('id', uid)
        .maybeSingle();

      const role = (prof?.role ?? 'student') as Role;
      if (!allow.includes(role)) {
        // 권한 부족 → 학생 홈으로
        if (!didRedirect.current) {
          didRedirect.current = true;
          router.replace('/student');
        }
        return;
      }
      setReady(true);
    })();
  }, [router, supabase, allow]);

  if (!ready) return null;
  return <>{children}</>;
}
