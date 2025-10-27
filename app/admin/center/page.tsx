// app/admin/center/page.tsx  (Server Component)

import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import CentersClient from './CentersClient';

export default async function CentersPage() {
  const supabase = getSupabaseServer();

  // 로그인 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/center');

  // 관리자 권한 확인 (profiles.role 사용)
  const { data: prof } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single();

  if (!prof || prof.role !== 'admin') redirect('/student');

  // 센터 목록 로드
  const { data: centers = [] } = await supabase
    .from('centers')
    .select('id, name, is_active')
    .order('name', { ascending: true });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-6 text-3xl font-bold">센터 관리</h1>
      <CentersClient initialCenters={centers ?? []} />
    </div>
  );
}
