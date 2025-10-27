'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
dayjs.locale('ko');

import RequireAuth from '@/components/auth/RequireAuth';
import { getSupabaseClient } from '@/lib/supabaseClient';
import CalendarBoard, { type Plan } from '@/components/planner/CalendarBoard';
import FloatingTimer from '@/components/planner/FloatingTimer';

export default function StudentPlannerPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const params = useSearchParams();

  const [meId, setMeId] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'teacher' | 'student'>('student');
  const [viewer, setViewer] = useState<string | null>(null);
  const readOnly = role !== 'student' || (viewer !== null && viewer !== meId);

  const displayName = params.get('name')?.trim() || '';

  // 입력폼 state
  const [subject, setSubject] = useState('');
  const [area, setArea] = useState('');
  const [content, setContent] = useState('');
  const [memo, setMemo] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      setMeId(uid);

      if (uid) {
        const { data: pf } = await supabase.from('profiles').select('id, role').eq('id', uid).maybeSingle();
        setRole((pf?.role ?? 'student') as any);
      }
      const urlViewer = params.get('viewer');
      setViewer(urlViewer ?? uid ?? null);
    })();
  }, [params, supabase]);

  const fetchPlans = async () => {
    if (!viewer) return;
    const since = dayjs().subtract(60, 'day').toISOString();
    const { data } = await supabase
      .from('plans')
      .select('id,user_id,subject,area,content,memo,start_at,end_at')
      .eq('user_id', viewer)
      .gte('start_at', since)
      .order('start_at', { ascending: true });
    setPlans((data ?? []) as any);
  };

  useEffect(() => {
    fetchPlans();
    const reload = () => fetchPlans();
    window.addEventListener('plans-updated', reload as any);
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') fetchPlans();
    });
    return () => {
      window.removeEventListener('plans-updated', reload as any);
      window.removeEventListener('focus', reload);
    };
  }, [viewer]);

  const onSelectSlot = ({ start, end }: { start: string; end: string }) => {
    setStartAt(dayjs(start).format('YYYY-MM-DD HH:mm'));
    setEndAt(dayjs(end).format('YYYY-MM-DD HH:mm'));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const validate = () => {
    if (!subject.trim() || !area.trim() || !startAt || !endAt) { alert('과목/영역/시간은 필수입니다.'); return false; }
    return true;
  };

  const addPlan = async () => {
    if (readOnly || !meId) return;
    if (!validate()) return;

    const startISO = dayjs(startAt, 'YYYY-MM-DD HH:mm', true).toISOString();
    const endISO = dayjs(endAt, 'YYYY-MM-DD HH:mm', true).toISOString();

    const tempId = `temp_${Date.now()}`;
    const optimistic: Plan = {
      id: tempId, user_id: meId, subject, area,
      content: content || null, memo: memo || null,
      start_at: startISO, end_at: endISO,
    } as any;
    setPlans((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('plans')
      .insert({ user_id: meId, subject, area, content: content || null, memo: memo || null, start_at: startISO, end_at: endISO })
      .select('id,user_id,subject,area,content,memo,start_at,end_at').single();

    if (error || !data) {
      setPlans((prev) => prev.filter((p) => p.id !== tempId));
      alert(error?.message ?? '저장 실패'); return;
    }
    setContent(''); setMemo('');
    setPlans((prev) => prev.map((p) => (p.id === tempId ? (data as any) : p)));
    localStorage.setItem('plans-updated-ping', Date.now().toString());
    window.dispatchEvent(new Event('plans-updated'));
  };

  return (
    <RequireAuth>
      <main className="mx-auto max-w-6xl p-4 space-y-4">
        <h1 className="text-2xl font-bold">
		  {viewer && viewer !== meId
			? (displayName ? `${displayName} 학생의 플래너` : '학생의 플래너(열람 모드)')
			: (displayName ? `${displayName} 학생의 플래너` : '나의 플래너')}
		</h1>


        {!readOnly && (
          <section ref={formRef} className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
            <input className="rounded-md border p-2" placeholder="예: 국어" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <input className="rounded-md border p-2" placeholder="예: 독서 / 문학 / 문법 …" value={area} onChange={(e) => setArea(e.target.value)} />
            <input className="rounded-md border p-2" placeholder="예: 현대시 읽기, 기출분석 등" value={content} onChange={(e) => setContent(e.target.value)} />
            <input className="rounded-md border p-2" placeholder="메모" value={memo} onChange={(e) => setMemo(e.target.value)} />
            <input className="rounded-md border p-2 md:col-span-2" placeholder="시작 (YYYY-MM-DD HH:mm)" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            <input className="rounded-md border p-2" placeholder="종료 (YYYY-MM-DD HH:mm)" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            <button onClick={addPlan} className="rounded-md bg-black px-4 py-2 text-white">추가</button>
          </section>
        )}

        <CalendarBoard plans={plans} readOnly={readOnly} onSelectSlot={onSelectSlot} />

        <FloatingTimer show={!readOnly} />
      </main>
    </RequireAuth>
  );
}
