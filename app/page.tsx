'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

// 기존에 쓰던 플래너 컴포넌트 유지
import StudentAppPage from './student/page';

export default function RootPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setHasSession(true);
        // 로그인된 경우 /student 경로로 교체
        router.replace('/student');
      } else {
        setHasSession(false);
        // 로그인 안 된 경우 /login으로 교체
        router.replace('/login');
      }
      setChecking(false);
    };
    checkSession();
  }, [router, supabase]);

  // 로딩 중에는 임시 화면 표시
  if (checking) {
    return (
      <main className="flex h-screen items-center justify-center">
        <p>세션 확인 중...</p>
      </main>
    );
  }

  // 혹시 replace 되기 전에 렌더링될 수 있으므로,
  // 원래 가지고 있던 StudentAppPage 기능은 로그인된 경우만 보여줌
  if (hasSession) {
    return <StudentAppPage />;
  }

  // 비로그인 상태라면 아무것도 안 보이게 처리
  return null;
}
