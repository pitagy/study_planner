'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function Signup() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  const [name,setName]=useState(''); const [phone,setPhone]=useState('');
  const router=useRouter();

  const onSubmit=async(e:React.FormEvent)=>{ e.preventDefault();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) { alert(error?.message || 'Sign up failed'); return; }
    await supabase.from('profiles').insert({
      id: data.user.id, email, name, phone, role: 'student', approved: false
    });
    router.replace('/login?pending=1');
  };

  return (
    <form onSubmit={onSubmit} className="p-6 max-w-md mx-auto space-y-3">
      <h1 className="text-2xl font-bold">회원가입</h1>
      <input placeholder="이메일" className="input" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="비밀번호" type="password" className="input" value={password} onChange={e=>setPassword(e.target.value)} />
      <input placeholder="이름" className="input" value={name} onChange={e=>setName(e.target.value)} />
      <input placeholder="전화번호" className="input" value={phone} onChange={e=>setPhone(e.target.value)} />
      <button className="btn">가입</button>
    </form>
  );
}
