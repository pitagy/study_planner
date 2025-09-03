'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Login() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  const router=useRouter(); const q=useSearchParams();
  const pending=q.get('pending');

  const onSubmit=async(e:React.FormEvent)=>{ e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) { alert(error?.message || 'Login failed'); return; }
    router.replace('/app');
  };

  useEffect(()=>{ supabase.auth.getSession().then(({data})=>{
    if(data.session) router.replace('/app');
  }); },[router]);

  return (
    <form onSubmit={onSubmit} className="p-6 max-w-md mx-auto space-y-3">
      <h1 className="text-2xl font-bold">로그인</h1>
      {pending && <p className="text-sm text-gray-600">가입 완료! 관리자 승인 후 이용 가능합니다.</p>}
      <input placeholder="이메일" className="input" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="비밀번호" type="password" className="input" value={password} onChange={e=>setPassword(e.target.value)} />
      <button className="btn">로그인</button>
    </form>
  );
}
