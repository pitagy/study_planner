// app/teacher/layout.tsx
import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import TeacherLayoutClient from './layoutClient';

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const supabase = getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/teacher');

  const { data: prof, error } = await supabase
    .from('profiles')
    .select('role, approved, email, student_name')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !prof) redirect('/signup');
  if (!prof.approved) redirect('/pending');
  if (!(prof.role === 'teacher' || prof.role === 'admin')) redirect(`/${prof.role}`);

  return (
    <TeacherLayoutClient
      email={prof.email}
      name={prof.student_name ?? '선생님'}
      role={prof.role}
    >
      {children}
    </TeacherLayoutClient>
  );
}
