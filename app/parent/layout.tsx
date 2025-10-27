// app/parent/layout.tsx
import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import ParentLayoutClient from './layoutClient';

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login?redirect=/parent');

  const { data: prof, error } = await supabase
    .from('profiles')
    .select('role, approved, email, student_name')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !prof) redirect('/signup');
  if (!prof.approved) redirect('/pending');
  if (prof.role !== 'parent') redirect(`/${prof.role}`);

  return (
    <ParentLayoutClient
      email={prof.email}
      name={prof.student_name ?? '학부모'}
      role={prof.role}
    >
      {children}
    </ParentLayoutClient>
  );
}
