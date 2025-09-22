'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type Role = 'admin'|'teacher'|'student';
export type Profile = { id:string; email:string; name?:string|null; role:Role; approved:boolean };

export async function fetchProfile(): Promise<Profile | null> {
  const { data:{ session } } = await supabase.auth.getSession();
  if(!session) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, approved')
    .eq('id', session.user.id)
    .single();
  if(error) return null;
  return data as Profile;
}

export function useProfile() {
  const [profile,setProfile]=useState<Profile|null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const p = await fetchProfile();
      setProfile(p);
      setLoading(false);
    })();
  },[]);

  useEffect(()=>{
    const { data: sub } = supabase.auth.onAuthStateChange((_evt) => {
      (async()=>{ setProfile(await fetchProfile()); })();
    });
    return ()=>{ sub.subscription.unsubscribe(); }
  },[]);

  return { profile, loading };
}
