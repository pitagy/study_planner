'use client';
import { supabase } from './supabaseClient';

export async function getMyProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,name,role,approved')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}
