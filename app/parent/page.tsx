'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type StudentRow = {
  id: string;
  email: string | null;
  student_name: string | null;
  center_name: string | null;
};

function persistViewer(id: string, name?: string | null) {
  try {
    localStorage.setItem(
      'viewerContext',
      JSON.stringify({ viewer: id, name: name ?? '', ts: Date.now() })
    );
  } catch {}
}

function withViewerBase(path: string, id: string, name?: string | null) {
  const u = new URL(path, window.location.origin);
  u.searchParams.set('viewer', id);
  if (name) u.searchParams.set('name', name);
  return u.toString();
}

export default function ParentPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [children, setChildren] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setErr('로그인이 필요합니다.');
        setLoading(false);
        return;
      }

      // 부모-자녀 연결 정보 가져오기
      const { data: links, error: linkErr } = await supabase
        .from('parent_student_links')
        .select('student_id')
        .eq('parent_id', auth.user.id);

      if (linkErr) {
        setErr(linkErr.message);
        setLoading(false);
        return;
      }

      if (!links || links.length === 0) {
        setChildren([]);
        setLoading(false);
        return;
      }

      const studentIds = links.map((l) => l.student_id);
      const { data: students, error: stuErr } = await supabase
        .from('profiles')
        .select('id, email, student_name, center_name')
        .in('id', studentIds)
        .order('student_name', { ascending: true });

      if (stuErr) setErr(stuErr.message);
      setChildren((students as any) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

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
      <h1 className="mb-6 text-3xl font-bold">학부모 페이지</h1>

      {loading ? (
        <div className="text-sm text-gray-500">불러오는 중…</div>
      ) : err ? (
        <div className="text-sm text-red-600">{err}</div>
      ) : children.length === 0 ? (
        <div className="text-sm text-gray-500">연결된 학생이 없습니다.</div>
      ) : (
        <ul className="space-y-4">
          {children.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm"
            >
              <div>
                <div className="text-lg font-semibold">{c.student_name || '무명'}</div>
                <div className="text-gray-600">{c.email}</div>
                <div className="text-xs text-gray-500">{c.center_name ?? ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                  onClick={() => openPlanner(c)}
                >
                  {c.student_name || '학생'} 플래너
                </button>
                <button
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                  onClick={() => openDashboard(c)}
                >
                  {c.student_name || '학생'} 대시보드
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
