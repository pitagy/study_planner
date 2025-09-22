'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  const [approved, setApproved] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('approved')
        .eq('id', session.user.id)
        .single();
      if (!profile) { router.replace('/login'); return; }
      setApproved(profile.approved);
      setOk(true);
    })();
  }, [router]);

  if (!ok) return null;
  if (!approved) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">승인 대기 중</h1>
        <p className="text-gray-600">최고관리자의 승인 후 모든 기능을 사용할 수 있습니다.</p>
      </div>
    );
  }
  return <>{children}</>;
}
