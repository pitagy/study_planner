'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Role = 'admin' | 'teacher' | 'student' | 'pending';
type StudentRow = {
  id: string;
  email: string | null;
  student_name: string | null;
  center_name: string | null;
  role: Role;
};

// 로컬에 열람 대상 학생 정보 저장(새 창 이동 시 사용)
function persistViewer(id: string, name?: string | null) {
  try {
    localStorage.setItem(
      'viewerContext',
      JSON.stringify({ viewer: id, name: name ?? '', ts: Date.now() })
    );
  } catch {}
}

function withViewerBase(path: string, id: string, name?: string | null) {
  const base = window.location.origin; // 현재 서버 주소 (http://localhost:3000)
  const u = new URL(path, base);
  u.searchParams.set('viewer', id);
  if (name) u.searchParams.set('name', name);
  return u.toString();
}

export default function TeacherPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [q, setQ] = useState('');
  const [me, setMe] = useState<{ role: Role; center_name: string | null } | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      // 1) 내 프로필 로드 (role/center 확인)
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setErr('로그인이 필요합니다.');
        setLoading(false);
        return;
      }
      const { data: meRow, error: meError } = await supabase
        .from('profiles')
        .select('role, center_name')
        .eq('id', auth.user.id)
        .single();

      if (meError || !meRow) {
        setErr(meError?.message ?? '내 프로필을 불러오지 못했습니다.');
        setLoading(false);
        return;
      }
      setMe(meRow as any);

      // 2) 학생 목록 로드
      let query = supabase
        .from('profiles')
        .select('id, email, student_name, role, center_name')
        .eq('role', 'student')
        .order('student_name', { ascending: true });

      // 선생님이면 본인 센터로 제한, 관리자는 전체 열람
      if (meRow.role === 'teacher' && meRow.center_name) {
        query = query.eq('center_name', meRow.center_name);
      }

      const { data: rows, error } = await query;
      if (error) setErr(error.message);
      setStudents((rows as any) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  const filtered = students.filter((s) =>
    `${s.student_name ?? ''} ${s.email ?? ''}`.toLowerCase().includes(q.toLowerCase())
  );

  const openPlanner = (s: StudentRow) => {
    persistViewer(s.id, s.student_name);
    window.open(withViewerBase('/student', s.id, s.student_name ?? undefined), '_blank', 'noopener');
  };

  const openDashboard = (s: StudentRow) => {
    persistViewer(s.id, s.student_name);
    window.open(
      withViewerBase('/student/dashboard', s.id, s.student_name ?? undefined),
      '_blank',
      'noopener'
    );
  };

  return (
    <main>
      <h1 className="mb-6 text-3xl font-bold">선생님 페이지</h1>

      {me?.role === 'teacher' && (
        <div className="mb-2 text-sm text-gray-600">
          현재 센터: <b>{me.center_name ?? '미지정'}</b>
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <input
          className="w-72 rounded-md border px-3 py-2 text-sm"
          placeholder="학생 검색(이름/이메일)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">불러오는 중…</div>
      ) : err ? (
        <div className="text-sm text-red-600">{err}</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-500">학생 목록이 비어 있어요.</div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm"
            >
              <div>
                <div className="text-lg font-semibold">{p.student_name || '무명'}</div>
                <div className="text-gray-600">{p.email}</div>
                <div className="text-xs text-gray-500">{p.center_name ?? ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                  onClick={() => openPlanner(p)}
                >
                  {p.student_name || '학생'} 플래너
                </button>
                <button
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                  onClick={() => openDashboard(p)}
                >
                  {p.student_name || '학생'} 대시보드
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
