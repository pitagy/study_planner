'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    console.log('🚀 로그인 시도:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ 로그인 실패:', error.message);
      setError('로그인 실패: ' + error.message);
      return;
    }

    console.log('✅ 로그인 성공:', data);

    // 성공 시, post-login 페이지로 이동 (역할 분기 담당)
    router.replace('/post-login');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-6">로그인</h1>

      <form onSubmit={handleLogin} className="flex flex-col gap-4 w-80">
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="p-3 border rounded"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-3 border rounded"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="bg-black text-white py-2 rounded">
          로그인
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-500">
        아직 계정이 없으신가요?{' '}
        <a href="/signup" className="text-blue-500">
          회원가입
        </a>
      </p>
    </div>
  );
}
