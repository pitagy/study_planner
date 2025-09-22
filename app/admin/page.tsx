'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  email: string;
  name?: string | null;
  role: 'pending' | 'student' | 'teacher' | 'admin';
};

function persistViewer(id: string, name?: string | null) {
  try {
    // 새 탭(동일 도메인)에서도 읽을 수 있도록 뷰어 컨텍스트 저장
    localStorage.setItem(
      'viewerContext',
      JSON.stringify({
        viewer: id,
        name: name ?? '',
        // 혹시 이전 값과 구분하려고 타임스탬프도 남겨둡니다.
        ts: Date.now(),
      }),
    );
  } catch {}
}

function withViewerBase(path: string, id: string, name?: string | null) {
  const u = new URL(path, window.location.origin);
  u.searchParams.set('viewer', id);
  if (name) u.searchParams.set('name', name);
  return u.toString();
}

export default function AdminPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [q, setQ] = useState('');
  const [list, setList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,name,role')
      .order('role', { ascending: true })
      .order('email', { ascending: true });
    if (!error) setList((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = list.filter((p) => {
    const key = (p.name || '') + ' ' + (p.email || '');
    return key.toLowerCase().includes(q.toLowerCase());
  });

  const updateRole = async (id: string, role: Profile['role']) => {
    await supabase.from('profiles').update({ role }).eq('id', id);
    await fetchAll();
  };

  const openStudentPlanner = (p: Profile) => {
    persistViewer(p.id, p.name);
    const url = withViewerBase('/student', p.id, p.name || undefined);
    window.open(url, '_blank', 'noopener');
  };

  const openStudentDashboard = (p: Profile) => {
    persistViewer(p.id, p.name);
    const url = withViewerBase('/student/dashboard', p.id, p.name || undefined);
    window.open(url, '_blank', 'noopener');
  };

  const Section = ({
    title,
    rows,
    roleOptions,
  }: {
    title: string;
    rows: Profile[];
    roleOptions: Profile['role'][];
  }) => (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <div className="text-sm text-gray-500">목록이 비어 있어요.</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id} className="items-start justify-between gap-4 rounded-lg border p-3 md:flex">
              <div className="mb-2 text-sm md:mb-0">
                <div className="font-medium">{p.name || '이름없음'}</div>
                <div className="text-gray-600">{p.email}</div>
                <div className="text-xs text-gray-400">{p.id}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{p.role}</span>
                <select
                  className="rounded-md border px-2 py-1 text-sm"
                  value={p.role}
                  onChange={(e) => updateRole(p.id, e.target.value as any)}
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                {p.role === 'student' && (
                  <>
                    <button
                      className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                      onClick={() => openStudentPlanner(p)}
                      title="학생 플래너를 새 창으로 열기"
                    >
                      {p.name || '학생'} 플래너
                    </button>
                    <button
                      className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                      onClick={() => openStudentDashboard(p)}
                      title="학생 대시보드를 새 창으로 열기"
                    >
                      {p.name || '학생'} 대시보드
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const pending = filtered.filter((p) => p.role === 'pending');
  const admins = filtered.filter((p) => p.role === 'admin');
  const teachers = filtered.filter((p) => p.role === 'teacher');
  const students = filtered.filter((p) => p.role === 'student');

  return (
    <main>
      <h1 className="mb-6 text-3xl font-bold">관리자 페이지</h1>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          className="w-64 rounded-md border px-3 py-2 text-sm"
          placeholder="이름/이메일 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50" onClick={fetchAll} disabled={loading}>
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="승인 대기" rows={pending} roleOptions={['pending', 'student', 'teacher', 'admin']} />
        <Section title="관리자" rows={admins} roleOptions={['admin', 'teacher', 'student', 'pending']} />
        <Section title="선생님" rows={teachers} roleOptions={['teacher', 'admin', 'student', 'pending']} />
        <Section title="학생" rows={students} roleOptions={['student', 'teacher', 'admin', 'pending']} />
      </div>
    </main>
  );
}
