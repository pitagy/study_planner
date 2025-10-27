// app/student/dashboard/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import ViewerDashboard from '@/components/dashboard/ViewerDashboard';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function StudentDashboardPage() {
  const supabase = getSupabaseClient();
  const params = useSearchParams();
  const viewer = params.get('viewer'); // URL에 ?viewer=uuid
  const [myUid, setMyUid] = useState<string | null>(null);
  const [role, setRole] = useState<string>('student');

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      setMyUid(uid);

      if (uid) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', uid)
          .maybeSingle();
        if (profile?.role) setRole(profile.role);
      }
    })();
  }, [supabase]);

  if (!myUid && !viewer) {
    return <main className="p-6">🔐 로그인 정보를 불러오는 중...</main>;
  }

  const isSelf = viewer === null || viewer === myUid;
  const nameLabel = isSelf ? '나의 대시보드' : '학생 대시보드';

  return (
    <main className="p-6">
      <ViewerDashboard
        viewerId={viewer ?? myUid!}
        viewerName={isSelf ? '나' : '류진선'} // 추후 profiles에서 name 가져오도록 변경 가능
        viewerRole={role}
      />
    </main>
  );
}
