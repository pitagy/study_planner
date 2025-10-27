import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
// import UserTopBar from '@/components/common/UserTopBar';
import AdminTopBar from '@/components/common/AdminTopBar';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = getSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin');

  const { data: prof } = await supabase
    .from('profiles')
    .select('role, approved, email')
    .eq('id', user.id)
    .single();

  if (!prof) redirect('/signup');
  if (!prof.approved) redirect('/pending');
  if (prof.role !== 'admin') redirect('/student');

  return (
    <div className="min-h-dvh">
      <AdminTopBar email={prof.email} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
