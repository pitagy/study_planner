'use client';

import { useMemo, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Student = { id: string; email: string; name?: string | null; role: 'student' };

function persistViewer(id: string, name?: string | null) {
  try {
    localStorage.setItem(
      'viewerContext',
      JSON.stringify({
        viewer: id,
        name: name ?? '',
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

export default function TeacherHome() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [q, setQ] = useState('');
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('id,email,name,role').eq('role', 'student');
      setStudents(((data as any) || []) as Student[]);
    })();
  }, [supabase]);

  const rows = students.filter((s) => ((s.name || '') + ' ' + s.email).toLowerCase().includes(q.toLowerCase()));

  const openPlanner = (s: Student) => {
    persistViewer(s.id, s.name);
    const url = withViewerBase('/student', s.id, s.name || undefined);
    window.open(url, '_blank', 'noopener');
  };

  const openDashboard = (s: Student) => {
    persistViewer(s.id, s.name);
    const url = withViewerBase('/student/dashboard', s.id, s.name || undefined);
    window.open(url, '_blank', 'noopener');
  };

  return (
    <main>
      <h1 className="mb-6 text-3xl font-bold">선생님 페이지</h1>

      <div className="mb-6 flex items-center gap-3">
        <input
          className="w-72 rounded-md border px-3 py-2 text-sm"
          placeholder="학생 검색(이름/이메일)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-gray-500">학생 목록이 비어 있어요.</div>
      ) : (
        <ul className="space-y-4">
          {rows.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm"
            >
              <div>
                <div className="text-lg font-semibold">{p.name || '무명'}</div>
                <div className="text-gray-600">{p.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                  onClick={() => openPlanner(p)}
                  title="학생 플래너를 새 창으로 열기"
                >
                  {p.name || '학생'} 학생 플래너
                </button>
                <button
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                  onClick={() => openDashboard(p)}
                  title="학생 대시보드를 새 창으로 열기"
                >
                  {p.name || '학생'} 학생 대시보드
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
