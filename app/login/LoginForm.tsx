'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = getSupabaseBrowser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 이미 로그인 상태면 우회
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace('/student');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setMsg(null);
    setLoading(true);

    try {
      try {
        localStorage.removeItem('viewerContext');
        localStorage.removeItem('ally-supports-cache');
      } catch {}

      const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError || !auth?.user) {
        setMsg(authError?.message ?? '이메일/비밀번호를 확인해 주세요.');
        return;
      }

      const userId = auth.user.id;

      // 프로필 조회
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id, role, approved')
        .eq('id', userId)
        .maybeSingle();

      if (pErr) {
        setMsg('프로필 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      // 최초 로그인 → 부트스트랩
      if (!profile) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        try {
          await fetch('/api/profiles/bootstrap', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
        } catch {}
        router.replace('/pending');
        return;
      }

      if (!profile.approved) {
        router.replace('/pending');
        return;
      }

      // 원래 가려던 페이지로
      const redirectedFrom = params.get('redirectedFrom');
      if (redirectedFrom && redirectedFrom !== '/login') {
        router.replace(redirectedFrom);
        return;
      }

      // 역할별 기본 라우팅
      const next =
        profile.role === 'admin' ? '/admin' :
        profile.role === 'teacher' ? '/teacher' :
        '/student';
      router.replace(next);
    } catch (err) {
      setMsg('로그인 중 알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">로그인</h1>

      <form onSubmit={handleLogin} className="space-y-4" autoComplete="on">
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg bg-blue-50 px-4 py-3 outline-none ring-1 ring-blue-100 focus:ring-2 focus:ring-blue-300"
          required
          autoComplete="email"
          inputMode="email"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-blue-50 px-4 py-3 outline-none ring-1 ring-blue-100 focus:ring-2 focus:ring-blue-300"
          required
          autoComplete="current-password"
        />

        <button
          disabled={loading}
          className="w-full rounded-lg bg-black py-3 text-white transition-opacity disabled:opacity-60"
          aria-busy={loading}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>

        {msg && (
          <p className="text-sm text-red-500" role="alert">
            {msg}
          </p>
        )}
      </form>

      
    </div>
  );
}
