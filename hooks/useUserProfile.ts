'use client';

import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

/**
 * 유저 + 프로필 통합 훅
 * - auth.user_metadata.role 과 profiles.role 중 profiles.role 우선
 * - role이 일시적으로 undefined일 때는 'loading' 반환
 */
export function useUserProfile() {
  const supabase = getSupabaseClient();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const userData = data?.user;
        setUser(userData || null);

        if (userData) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userData.id)
            .maybeSingle();

          setProfile(prof || null);
        }
      } catch (e) {
        console.error('useUserProfile error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 역할(role) 계산 로직
  const role =
    profile?.role ||
    user?.user_metadata?.role ||
    'student';

  const effectiveRole = role || 'student';

  // 표시 이름
  const displayName =
    profile?.name ||
    user?.user_metadata?.name ||
    user?.email ||
    '사용자';

  return {
    user,
    profile,
    role: effectiveRole,
    displayName,
    loading,
  };
}
