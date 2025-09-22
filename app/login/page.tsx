'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// 브라우저 supabase 싱글턴
const supabase = getSupabaseBrowser();

function safeRedirect(q: string | null) {
  if (!q) return null;
  try {
    const u = new URL(q, 'http://x');
    const path = u.pathname + (u.search || '');
    return path.startsWith('/') ? path : null;
  } catch {
    return q.startsWith('/') ? q : null;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectParam = safeRedirect(params.get('redirect'));

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pw,
      });
      if (error) throw error;
      if (!data.user) throw new Error('로그인 실패: 사용자 정보 없음');

      // 역할에 따라 목적지 선택(선택사항) — 프로필 테이블에서 role 조회
      let target = redirectParam ?? '/student';
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();
        const role = (profile?.role as 'admin' | 'teacher' | 'student' | undefined) ?? 'student';
        if (!redirectParam) {
          target = role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/student';
        }
      } catch {
        // 조회 실패 시 기본값 유지
      }

      router.replace(target);
    } catch (e: any) {
      setErr(e?.message ?? '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">로그인</h1>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <input
          type="email"
          value={email}
          placeholder="이메일"
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border p-3"
          autoComplete="username email"
          required
        />
        <input
          type="password"
          value={pw}
          placeholder="비밀번호"
          onChange={(e) => setPw(e.target.value)}
          className="w-full rounded-md border p-3"
          autoComplete="current-password"
          required
        />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-black text-white py-3 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? '로그인 중…' : '로그인'}
        </button>
      </form>

      <div className="mt-4">
        <a
          href="/signup"
          className="block w-full text-center rounded-md border px-4 py-3 hover:bg-gray-50"
        >
          회원가입
        </a>
      </div>
    </main>
  );
}
