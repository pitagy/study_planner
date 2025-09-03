'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function Home(){
  const router = useRouter();
  useEffect(()=>{ (async()=>{
    const { data:{session} } = await supabase.auth.getSession();
    router.replace(session ? '/app' : '/login');
  })(); },[router]);
  return null;
}
