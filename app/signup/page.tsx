'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function SignupPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrMsg(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password: pw });
      if (error) {
        setErrMsg(error.message);
        return;
      }
      alert('회원가입 성공! 이메일 인증 후 로그인하세요.');
      router.replace('/login');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-xl mx-auto py-16">
      <h1 className="text-3xl font-semibold mb-8">회원가입</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          type="email"
          className="w-full rounded-md border p-3"
          required
        />
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="비밀번호"
          type="password"
          className="w-full rounded-md border p-3"
          required
        />
        {errMsg && <p className="text-sm text-red-600">{errMsg}</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-black text-white py-3 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? '가입 중…' : '가입하기'}
        </button>
      </form>
    </main>
  );
}
