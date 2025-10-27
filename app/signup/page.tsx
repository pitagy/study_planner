'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

type Center = { id: string; name: string };

export default function SignupPage() {
  const supabase = getSupabaseBrowser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [seatNo, setSeatNo] = useState<string>('');

  // 새로 추가된 상태
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerName, setCenterName] = useState('지산범물센터'); // 기본값

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('centers')
        .select('id, name')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('centers load error', error);
        return;
      }
      if (data && data.length > 0) {
        setCenters(data);
        // 기본값이 목록에 없으면 첫 번째로
        const hasDefault = data.some(c => c.name === '지산범물센터');
        setCenterName(hasDefault ? '지산범물센터' : data[0].name);
      }
    })();
  }, [supabase]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    // 1) 회원 생성
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {  emailRedirectTo: `${location.origin}/auth/callback` },
    });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    // 2) bootstrap 프로필 생성(API 라우트 사용 중이라면 유지)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setMsg('세션 토큰을 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/profiles/bootstrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          // API에서 사용하던 필드명 그대로 유지
          user_id: data.user?.id,
          email,
          role: 'student',
          approved: false,
          center_name: centerName,         // ← 드롭다운에서 선택된 이름
          student_name: studentName || null,
          seat_no: seatNo || null,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || '프로필 생성 실패');
      }

      setMsg('가입이 완료되었습니다. 관리자가 승인하면 이용할 수 있어요.');
    } catch (e: any) {
      setMsg(e.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">회원가입</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="이메일"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />

        <input
          className="w-full rounded border px-3 py-2"
          placeholder="비밀번호"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {/* 학생 이름 */}
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="학생 이름"
          value={studentName}
          onChange={e => setStudentName(e.target.value)}
          required
        />

        {/* 센터 드롭다운 */}
        <select
          className="w-full rounded border px-3 py-2"
          value={centerName}
          onChange={e => setCenterName(e.target.value)}
        >
          {centers.map(c => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        {/* 좌석번호(선택) */}
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="좌석번호(선택)"
          value={seatNo}
          onChange={e => setSeatNo(e.target.value)}
        />

        <button
          className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? '가입 중...' : '가입하기'}
        </button>
      </form>

      {msg && <p className="mt-4 text-sm text-rose-600">{msg}</p>}
    </div>
  );
}
