'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';

type Role = 'admin' | 'teacher' | 'student' | 'parent' | 'pending';

export default function RequireAuth({
  allow, // 허용 역할 목록 (예: ['admin'])
  children,
}: {
  allow?: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { loading, session, profile, error } = useProfile();

  useEffect(() => {
    if (loading) return;

    // 1️⃣ 로그인 안 된 경우
    if (!session) {
      router.replace('/login');
      return;
    }

    // 2️⃣ 프로필 조회 실패
    if (error) {
      console.error(error);
      router.replace('/login');
      return;
    }

    // 3️⃣ 프로필 정보 없음
    if (!profile) {
      router.replace('/post-login');
      return;
    }

    // 4️⃣ 승인 대기
    if (profile.role === 'pending' || !profile.approved) {
      router.replace('/login?status=pending');
      return;
    }

    // 5️⃣ 허용되지 않은 역할 접근 → 자신의 홈으로 이동
    if (allow && !allow.includes(profile.role as Role)) {
	const home =
	  profile?.role === 'admin'
		? '/admin'
		: profile?.role === 'teacher'
		? '/teacher'
		: profile?.role === 'parent'
		? '/parent'
		: '/student';

      router.replace(home);
    }
  }, [loading, session, profile, error, allow, router]);

  if (loading) {
    return <div className="p-8 text-center">로딩 중…</div>;
  }

  return <>{children}</>;
}
