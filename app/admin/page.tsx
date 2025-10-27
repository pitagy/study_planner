'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Role = 'pending' | 'student' | 'teacher' | 'admin' | 'parent';

type Profile = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  approved: boolean;
  center_name?: string | null;
};

const CENTER_OPTIONS = [
  '전체',
  '동성로센터',
  '포항센터',
  '지산범물캠프',
  '상인센터',
  '월성센터',
  '수성구센터',
  '시지센터',
];

const ROLE_OPTIONS: Role[] = ['pending', 'student', 'teacher', 'parent'];

// ✅ AI 요약 함수 경로 자동 분기
const getAiSummaryUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    // 로컬 Supabase Functions Dev 서버
    return 'http://127.0.0.1:54321/functions/v1/ai_summary';
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/functions/v1/ai_summary`;
};

export default function AdminPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [list, setList] = useState<Profile[]>([]);
  const [parentLinks, setParentLinks] = useState<Record<string, any[]>>({});
  const [q, setQ] = useState('');
  const [selectedCenter, setSelectedCenter] = useState('전체');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [roleChanges, setRoleChanges] = useState<Record<string, Role>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);

  // ───────────────────────────────
  // 🔹 데이터 불러오기
  // ───────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,role,approved,name:student_name,center_name')
      .order('role', { ascending: true })
      .order('email', { ascending: true });

    if (error) {
      setErr(error.message);
      setList([]);
      setLoading(false);
      return;
    }

    setList(data ?? []);

    const { data: links } = await supabase
      .from('parent_student_links')
      .select('parent_id, student_id');

    if (links?.length) {
      const studentIds = [...new Set(links.map((l) => l.student_id))];
      const { data: students } = await supabase
        .from('profiles')
        .select('id, student_name, center_name')
        .in('id', studentIds);
      const map: Record<string, any[]> = {};
      for (const l of links) {
        const s = students?.find((st) => st.id === l.student_id);
        if (!map[l.parent_id]) map[l.parent_id] = [];
        if (s) map[l.parent_id].push(s);
      }
      setParentLinks(map);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // ───────────────────────────────
  // 🔹 승인/역할 변경/삭제
  // ───────────────────────────────
  const approveUser = async (id: string) => {
    const newRole = roleChanges[id];
    if (!newRole || newRole === 'pending') {
      alert('승인할 역할을 먼저 선택하세요.');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, approved: true })
      .eq('id', id);
    if (error) alert('승인 중 오류 발생');
    else await fetchAll();
  };

  const updateRole = async (id: string, newRole: Role) => {
    if (!window.confirm(`역할을 "${newRole}"로 변경하시겠습니까?`)) return;
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', id);
    if (error) alert('역할 변경 중 오류');
    else await fetchAll();
  };

  const deleteUser = async (id: string, email: string) => {
    if (!window.confirm(`정말 ${email} 사용자를 탈퇴시키겠습니까?`)) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) alert('회원 탈퇴 중 오류');
    else await fetchAll();
  };

  // ───────────────────────────────
  // 🧠 AI 요약 실행 (Authorization 헤더 추가)
  // ───────────────────────────────
  const runAiSummary = async (id: string, name?: string | null) => {
    try {
      setAiLoading(id);
      setAiSuccess(null);

      const res = await fetch(getAiSummaryUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // ✅ 로컬에서도 Authorization 헤더 강제 추가
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ user_id: id }),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || `요약 실행 실패 (${res.status})`);

      console.log(`✅ ${name || '학생'} 요약 완료`);
      setAiSuccess(id);
      setTimeout(() => setAiSuccess(null), 5000);
    } catch (err: any) {
      console.error('AI summary error:', err);
      alert(`❌ AI 요약 실행 중 오류: ${err?.message || err}`);
    } finally {
      setAiLoading(null);
    }
  };

  // ───────────────────────────────
  // 🔍 필터링
  // ───────────────────────────────
  const filtered = list.filter((p) =>
    `${p.name ?? ''} ${p.email ?? ''}`.toLowerCase().includes(q.toLowerCase())
  );

  const waiting = filtered.filter((p) => !p.approved);
  const admins = filtered.filter((p) => p.approved && p.role === 'admin');
  const teachers = filtered.filter((p) => p.approved && p.role === 'teacher');
  const students = filtered.filter(
    (p) =>
      p.approved &&
      p.role === 'student' &&
      (selectedCenter === '전체' || p.center_name === selectedCenter)
  );
  const parents = filtered.filter((p) => {
    if (!(p.approved && p.role === 'parent')) return false;
    if (selectedCenter === '전체') return true;
    const linkedStudents = parentLinks[p.id] || [];
    return linkedStudents.some((st) => st.center_name === selectedCenter);
  });

  // ───────────────────────────────
  // 🧩 UI 렌더링
  // ───────────────────────────────
  const Section = ({
    title,
    rows,
    isWaiting = false,
  }: {
    title: string;
    rows: Profile[];
    isWaiting?: boolean;
  }) => (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      {loading && <div className="text-sm text-gray-500">불러오는 중...</div>}
      {err && <div className="text-sm text-red-500">오류: {err}</div>}
      {!loading && !err && rows.length === 0 && (
        <div className="text-sm text-gray-500">목록이 비어 있습니다.</div>
      )}

      <ul className="space-y-2">
        {rows.map((p) => {
          const linkedStudents =
            p.role === 'parent' ? parentLinks[p.id] || [] : [];

          return (
            <li
              key={p.id}
              className="border rounded-lg p-3 flex justify-between items-start hover:bg-blue-50 transition relative"
            >
              {/* 왼쪽 정보 */}
              <div className="flex flex-col text-left">
                <div className="font-semibold text-gray-900">
                  {p.name || '이름없음'}
                </div>
                <div className="text-xs text-gray-500">UID: {p.id}</div>
                <div className="text-xs text-gray-400 mb-1">
                  {p.center_name || '센터 정보 없음'}
                </div>

                {/* 🧠 AI 요약 버튼 */}
                {p.role === 'student' && (
                  <button
                    onClick={() => runAiSummary(p.id, p.name)}
                    disabled={aiLoading === p.id}
                    className={`mt-2 w-fit text-xs px-3 py-1.5 border-2 rounded-lg font-medium shadow-sm transition-all duration-150 
                      ${
                        aiLoading === p.id
                          ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-yellow-200 to-yellow-400 border-yellow-500 text-yellow-900 hover:from-yellow-300 hover:to-yellow-500 hover:shadow-md'
                      }`}
                  >
                    {aiLoading === p.id ? 'AI 요약 중...' : 'AI 요약'}
                  </button>
                )}

                {/* ✅ AI 요약 완료 배너 */}
                {aiSuccess === p.id && (
                  <div className="mt-2 text-sm font-medium bg-green-100 border border-green-400 text-green-800 rounded-md px-2 py-1 w-fit animate-fadeIn">
                    ✅ 이번 주 AI 요약이 생성되었습니다.
                  </div>
                )}

                <div className="mt-2 text-sm text-gray-600">{p.email}</div>
              </div>

              {/* 오른쪽 관리 */}
              <div className="flex flex-col items-end gap-2">
                {p.role !== 'admin' && (
                  <select
                    value={isWaiting ? 'pending' : roleChanges[p.id] ?? p.role}
                    onChange={(e) => {
                      const newRole = e.target.value as Role;
                      setRoleChanges((prev) => ({ ...prev, [p.id]: newRole }));
                      if (!isWaiting) updateRole(p.id, newRole);
                    }}
                    className="text-xs border rounded px-1 py-0.5"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r === 'pending'
                          ? '승인대기'
                          : r === 'student'
                          ? '학생'
                          : r === 'teacher'
                          ? '선생님'
                          : r === 'parent'
                          ? '학부모'
                          : r}
                      </option>
                    ))}
                  </select>
                )}

                {isWaiting && (
                  <button
                    onClick={() => approveUser(p.id)}
                    className="text-xs border px-2 py-1 rounded bg-green-100 hover:bg-green-200"
                  >
                    승인하기
                  </button>
                )}

                {p.role !== 'admin' && (
                  <button
                    onClick={() => deleteUser(p.id, p.email)}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    회원탈퇴
                  </button>
                )}

                {p.role === 'student' && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() =>
                        window.open(
                          `/student?viewer=${p.id}&name=${p.name}`,
                          '_blank'
                        )
                      }
                      className="text-xs border px-2 py-1 rounded hover:bg-blue-50"
                    >
                      {p.name} 플래너
                    </button>
                    <button
                      onClick={() =>
                        window.location.assign(
                          `/student/dashboard?viewer=${p.id}&name=${p.name}`
                        )
                      }
                      className="text-xs border px-2 py-1 rounded hover:bg-green-50"
                    >
                      {p.name} 대시보드
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );

  // ───────────────────────────────
  // 🧩 메인
  // ───────────────────────────────
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">관리자 페이지</h1>

      <div className="flex gap-3 items-center">
        <input
          className="w-64 rounded-md border px-3 py-2 text-sm"
          placeholder="이름/이메일 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={fetchAll}
          disabled={loading}
        >
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="관리자" rows={admins} />
        <Section title="선생님" rows={teachers} />
      </div>

      <Section title="승인 대기" rows={waiting} isWaiting />

      <div className="flex flex-wrap items-center justify-between gap-4 border p-4 rounded-lg bg-gray-50">
        <div className="flex gap-2 items-center">
          <label className="text-sm text-gray-700">센터 선택:</label>
          <select
            value={selectedCenter}
            onChange={(e) => setSelectedCenter(e.target.value)}
            className="border rounded-md text-sm px-2 py-1"
          >
            {CENTER_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-6 text-sm">
          <div>학생 수: <strong>{students.length}</strong></div>
          <div>학부모 수: <strong>{parents.length}</strong></div>
          <div>승인 대기: <strong>{waiting.length}</strong></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="학생" rows={students} />
        <Section title="학부모" rows={parents} />
      </div>
    </main>
  );
}
