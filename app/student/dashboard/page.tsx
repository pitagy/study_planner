// app/student/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import utc from 'dayjs/plugin/utc';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(utc);
dayjs.extend(isBetween);
dayjs.locale('ko');

import jsPDF from 'jspdf';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
  LabelList,
} from 'recharts';

// ---- Supabase client(프로젝트별 헬퍼명 대응) ----
import * as SB from '@/lib/supabaseClient';
const pickSupabase = () =>
  typeof (SB as any).getSupabaseBrowser === 'function'
    ? (SB as any).getSupabaseBrowser()
    : (SB as any).getSupabaseClient();

// ------------------------------------------------------------------
// 유틸: UTC ISO → 로컬 dayjs, 두 구간 겹치는 분 계산
// ------------------------------------------------------------------
const toLocal = (isoUtc: string) => dayjs.utc(isoUtc).local();
const overlapMinutesLocal = (aStartISO: string, aEndISO: string, bStartISO: string, bEndISO: string) => {
  const a1 = toLocal(aStartISO).valueOf();
  const a2 = toLocal(aEndISO).valueOf();
  const b1 = toLocal(bStartISO).valueOf();
  const b2 = toLocal(bEndISO).valueOf();
  const ms = Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
  return Math.floor(ms / 60000);
};

// ------------------------------------------------------------------
// 타입
// ------------------------------------------------------------------
type Last7Item = { date: string; plan: number; actual: number; ratio: number };
type SubjectItem = { subject: string; plan: number; actual: number };
type HourBucket = { label: string; actual: number };
type Habit = { streakDays: number; avgSessionMin: number; sessionCount7d: number };
type Stat = {
  titleName: string;
  // 상단 카드
  weekPlanCount: number;
  weekPlanMinutes: number;
  todayStudyMinutes: number;
  weekStudyMinutes: number;

  // 오늘(추가)
  todayPlanMinutes: number;
  todayActualMinutes: number; // == todayStudyMinutes 이지만 명확성 위해 별도 보관
  todayEfficiencyPct: number;
  subjectToday: SubjectItem[];

  // 기존 섹션들
  last7: Last7Item[];
  subjectWeek: SubjectItem[];
  timeOfDay: HourBucket[];
  habit: Habit;
};

export default function StudentDashboardPage() {
  const supabase = useMemo(() => pickSupabase(), []);
  const params = useSearchParams();

  const [stat, setStat] = useState<Stat | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // --------------------------------------------------------------
  // 1) 조회 대상 사용자 결정(학생/교사/관리자 공통)
  // --------------------------------------------------------------
  const resolveTarget = async () => {
    const { data } = await supabase.auth.getSession();
    const myUid = data.session?.user?.id;
    if (!myUid) return { ok: false as const, reason: 'no-session' as const };

    const viewer = params.get('viewer'); // 다른 학생 열람 시 전달되는 uid
    const nameFromURL = params.get('name') ?? undefined;

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role, name')
      .eq('id', myUid)
      .maybeSingle();

    const myRole = (myProfile?.role ?? 'student') as 'student' | 'teacher' | 'admin';

    if (!viewer) {
      // 학생 본인
      return { ok: true as const, uid: myUid, isSelf: true, name: myProfile?.name ?? '학생' };
    }
    if (myRole === 'teacher' || myRole === 'admin') {
      // 교사/관리자: viewer 열람
      return { ok: true as const, uid: viewer, isSelf: false, name: nameFromURL ?? '학생' };
    }
    // 학생 권한에서 viewer가 있더라도 본인으로 고정
    return { ok: true as const, uid: myUid, isSelf: true, name: myProfile?.name ?? '학생' };
  };

  // --------------------------------------------------------------
  // 2) 데이터 수집 및 집계
  // --------------------------------------------------------------
  const refetch = async () => {
    try {
      setLoading(true);
      setErr(null);

      const target = await resolveTarget();
      if (!target.ok) {
        setErr('세션이 만료되었어요. 다시 로그인 해 주세요.');
        setLoading(false);
        return;
      }
      const targetUid = target.uid;
      const titleName = target.name;

      // 최근 7일(로컬) 범위
      const today = dayjs();
      const start7 = today.subtract(6, 'day').startOf('day');
      const end7 = today.endOf('day');

      // plans (최근 7일과 겹치는 것만)
      const { data: plans, error: pErr } = await supabase
        .from('plans')
        .select('id,user_id,subject,start_at,end_at')
        .eq('user_id', targetUid)
        .gte('end_at', start7.toDate().toISOString())
        .lte('start_at', end7.toDate().toISOString());
      if (pErr) throw pErr;

      // sessions (최근 7일과 겹치는 것만)
      const { data: sessions, error: sErr } = await supabase
        .from('sessions')
        .select('id,plan_id,user_id,actual_start,actual_end,duration_min')
        .eq('user_id', targetUid)
        .gte('actual_end', start7.toDate().toISOString())
        .lte('actual_start', end7.toDate().toISOString());
      if (sErr) throw sErr;

      // 오늘/이번주 구간
      const todayStartISO = today.startOf('day').toDate().toISOString();
      const todayEndISO = today.endOf('day').toDate().toISOString();
      const weekStartISO = today.startOf('week').toDate().toISOString();
      const weekEndISO = today.endOf('week').toDate().toISOString();

      // ---------------- 최근 7일: 일자별 계획/실제 ----------------
      const days7 = Array.from({ length: 7 }).map((_, i) => start7.add(i, 'day'));
      const last7: Last7Item[] = days7.map((d) => {
        const dStartISO = d.startOf('day').toDate().toISOString();
        const dEndISO = d.endOf('day').toDate().toISOString();

        const plan = (plans ?? []).reduce((sum, pl) => {
          if (!pl.start_at || !pl.end_at) return sum;
          return sum + overlapMinutesLocal(pl.start_at, pl.end_at, dStartISO, dEndISO);
        }, 0);

        const actual = (sessions ?? []).reduce((sum, s) => {
          if (!s.actual_start || !s.actual_end) return sum;
          return sum + overlapMinutesLocal(s.actual_start, s.actual_end, dStartISO, dEndISO);
        }, 0);

        const ratio = plan ? Math.round((actual / plan) * 100) : 0;
        return { date: d.format('MM/DD'), plan, actual, ratio };
      });

      // ---------------- 카드: 오늘/이번 주 ----------------
      const weekPlanCount = (plans ?? []).filter((pl) => {
        if (!pl.start_at || !pl.end_at) return false;
        return overlapMinutesLocal(pl.start_at, pl.end_at, weekStartISO, weekEndISO) > 0;
      }).length;

      const weekPlanMinutes = (plans ?? []).reduce((sum, pl) => {
        if (!pl.start_at || !pl.end_at) return sum;
        return sum + overlapMinutesLocal(pl.start_at, pl.end_at, weekStartISO, weekEndISO);
      }, 0);

      const weekStudyMinutes = (sessions ?? []).reduce((sum, s) => {
        if (!s.actual_start || !s.actual_end) return sum;
        return sum + overlapMinutesLocal(s.actual_start, s.actual_end, weekStartISO, weekEndISO);
      }, 0);

      const todayActualMinutes = (sessions ?? []).reduce((sum, s) => {
        if (!s.actual_start || !s.actual_end) return sum;
        return sum + overlapMinutesLocal(s.actual_start, s.actual_end, todayStartISO, todayEndISO);
      }, 0);

      const todayPlanMinutes = (plans ?? []).reduce((sum, pl) => {
        if (!pl.start_at || !pl.end_at) return sum;
        return sum + overlapMinutesLocal(pl.start_at, pl.end_at, todayStartISO, todayEndISO);
      }, 0);

      const todayEfficiencyPct = todayPlanMinutes > 0 ? Math.round((todayActualMinutes / todayPlanMinutes) * 100) : 0;

      // ---------------- 오늘 과목별 계획/실제 (추가) ----------------
      const bySubjectToday = new Map<string, { plan: number; actual: number }>();

      // 오늘 계획 분
      (plans ?? []).forEach((pl) => {
        if (!pl.subject || !pl.start_at || !pl.end_at) return;
        const minutes = overlapMinutesLocal(pl.start_at, pl.end_at, todayStartISO, todayEndISO);
        if (!minutes) return;
        const prev = bySubjectToday.get(pl.subject) ?? { plan: 0, actual: 0 };
        prev.plan += minutes;
        bySubjectToday.set(pl.subject, prev);
      });

      // 오늘 실제 분(세션 → 계획 매핑, 없으면 기타)
      (sessions ?? []).forEach((s) => {
        if (!s.actual_start || !s.actual_end) return;

        let subject = '기타';
        if (s.plan_id) {
          const pl = (plans ?? []).find((p) => p.id === s.plan_id);
          if (pl?.subject) subject = pl.subject;
        }
        const minutes = overlapMinutesLocal(s.actual_start, s.actual_end, todayStartISO, todayEndISO);
        if (!minutes) return;
        const prev = bySubjectToday.get(subject) ?? { plan: 0, actual: 0 };
        prev.actual += minutes;
        bySubjectToday.set(subject, prev);
      });

      const subjectToday: SubjectItem[] = Array.from(bySubjectToday.entries())
        .map(([subject, v]) => ({ subject, plan: v.plan, actual: v.actual }))
        .filter((x) => x.plan + x.actual > 0)
        .sort((a, b) => a.subject.localeCompare(b.subject));

      // ---------------- 이번주 과목별 계획/실제 ----------------
      const bySubjectWeek = new Map<string, { plan: number; actual: number }>();

      (plans ?? []).forEach((pl) => {
        if (!pl.subject || !pl.start_at || !pl.end_at) return;
        const minutes = overlapMinutesLocal(pl.start_at, pl.end_at, weekStartISO, weekEndISO);
        if (!minutes) return;
        const prev = bySubjectWeek.get(pl.subject) ?? { plan: 0, actual: 0 };
        prev.plan += minutes;
        bySubjectWeek.set(pl.subject, prev);
      });

      (sessions ?? []).forEach((s) => {
        if (!s.actual_start || !s.actual_end) return;

        let subject = '기타';
        if (s.plan_id) {
          const pl = (plans ?? []).find((p) => p.id === s.plan_id);
          if (pl?.subject) subject = pl.subject;
        }

        const minutes = overlapMinutesLocal(s.actual_start, s.actual_end, weekStartISO, weekEndISO);
        if (!minutes) return;

        const prev = bySubjectWeek.get(subject) ?? { plan: 0, actual: 0 };
        prev.actual += minutes;
        bySubjectWeek.set(subject, prev);
      });

      const subjectWeek: SubjectItem[] = Array.from(bySubjectWeek.entries()).map(
        ([subject, v]) => ({ subject, plan: v.plan, actual: v.actual })
      );

      // ---------------- 최근 7일 시간대별 실제(집중도) ----------------
      const buckets = [
        { label: '06-09', start: 6, end: 9 },
        { label: '09-12', start: 9, end: 12 },
        { label: '12-15', start: 12, end: 15 },
        { label: '15-18', start: 15, end: 18 },
        { label: '18-21', start: 18, end: 21 },
        { label: '21-24', start: 21, end: 24 },
      ];
      const timeOfDay: HourBucket[] = buckets.map((b) => ({ label: b.label, actual: 0 }));

      (sessions ?? []).forEach((s) => {
        if (!s.actual_start || !s.actual_end) return;
        const start = toLocal(s.actual_start);
        const end = toLocal(s.actual_end);

        buckets.forEach((b, idx) => {
          const bStart = start.startOf('day').hour(b.start).minute(0).second(0);
          const bEnd = start.startOf('day').hour(b.end).minute(0).second(0);
          const ms = Math.max(0, Math.min(end.valueOf(), bEnd.valueOf()) - Math.max(start.valueOf(), bStart.valueOf()));
          const min = Math.floor(ms / 60000);
          if (min > 0) timeOfDay[idx].actual += min;
        });
      });

      // ---------------- 습관 요약 ----------------
      const dailyActual = last7.map((d) => d.actual);
      let streak = 0;
      for (let i = dailyActual.length - 1; i >= 0; i -= 1) {
        if (dailyActual[i] > 0) streak += 1;
        else break;
      }
      const sessionCount7d = (sessions ?? []).length;
      const totalDur = (sessions ?? []).reduce((s, x) => s + (x.duration_min ?? 0), 0);
      const avgSessionMin = sessionCount7d > 0 ? Math.round(totalDur / sessionCount7d) : 0;

      setStat({
        titleName,
        weekPlanCount,
        weekPlanMinutes,
        todayStudyMinutes: todayActualMinutes,
        weekStudyMinutes,

        // 오늘(추가)
        todayPlanMinutes,
        todayActualMinutes,
        todayEfficiencyPct,
        subjectToday,

        // 기존
        last7,
        subjectWeek,
        timeOfDay,
        habit: { streakDays: streak, avgSessionMin, sessionCount7d },
      });
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? '대시보드 데이터를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.toString()]);

  // 다른 페이지(집중모드/플랫폼)에서 저장 후 자동 새로고침
  useEffect(() => {
    const reload = () => refetch();
    window.addEventListener('stats-updated', reload);
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reload();
    });
    return () => {
      window.removeEventListener('stats-updated', reload);
      window.removeEventListener('focus', reload);
    };
  }, []);

  // --------------------------------------------------------------
  // PDF 내보내기(간단 요약)
  // --------------------------------------------------------------
  const exportPDF = () => {
    if (!stat) return;
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`${params.get('viewer') ? `${stat.titleName} 학생` : '나의'} 주간 리포트`, 14, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`오늘 공부: ${stat.todayStudyMinutes}분 (계획 ${stat.todayPlanMinutes}분, 효율 ${stat.todayEfficiencyPct}%)`, 14, 32);
    doc.text(`최근 7일 계획/실제: ${stat.weekPlanMinutes} / ${stat.weekStudyMinutes}분`, 14, 40);
    doc.text(`연속 공부일: ${stat.habit.streakDays}일`, 14, 48);
    doc.save('study-week.pdf');
  };

  // --------------------------------------------------------------
  // 렌더링
  // --------------------------------------------------------------
  if (loading) {
    return <main className="min-h-screen"><div className="container mx-auto px-4 py-10 text-gray-600">대시보드 불러오는 중…</div></main>;
  }
  if (err) {
    return <main className="min-h-screen"><div className="container mx-auto px-4 py-10 text-red-600">{err}</div></main>;
  }
  if (!stat) return null;

  // 오늘 효율 미니 그래프 데이터
  const todayEffChart = [{ name: dayjs().format('MM/DD'), 효율: stat.todayEfficiencyPct }];

  // 오늘 과목별 데이터
  const subjectTodayChart = stat.subjectToday.map((r) => ({
    subject: r.subject,
    계획: r.plan,
    실제: r.actual,
  }));

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-6 flex items-end justify-between">
          <h1 className="mt-1 text-3xl font-bold">
            {params.get('viewer') ? `${stat.titleName} 학생의 대시보드` : '나의 대시보드'}
          </h1>
          <button
            onClick={exportPDF}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            title="PDF로 저장"
          >
            PDF 저장
          </button>
        </div>

        {/* 상단 카드 */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card title="지난 7일간 계획 수" value={`${stat.weekPlanCount}건`} />
          <Card title="지난 7일간 계획 시간" value={`${stat.weekPlanMinutes}분`} />
          <Card title="오늘 실제 공부시간" value={`${stat.todayStudyMinutes}분`} />
          <Card title="지난 7일간 실제 공부시간" value={`${stat.weekStudyMinutes}분`} />
        </div>

        {/* === (추가) 오늘의 효율 카드 & 미니 라인 === */}
        <section className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-gray-700">오늘의 효율</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card title="오늘 계획 시간" value={`${stat.todayPlanMinutes}분`} />
            <Card title="오늘 실제 시간" value={`${stat.todayActualMinutes}분`} />
            <Card title="효율(%)" value={`${stat.todayEfficiencyPct}%`} />
            <div className="rounded-lg border p-3">
              <div className="text-xs text-gray-500 mb-1">미니 추이</div>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={todayEffChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="효율" stroke="#0ea5e9" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* === (추가) 오늘의 과목별 계획 vs 실제 === */}
        <section className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-gray-700">오늘의 과목별 계획 vs 실제</div>
          {subjectTodayChart.length === 0 ? (
            <div className="text-sm text-gray-500">표시할 데이터가 없습니다.</div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={subjectTodayChart}
                  margin={{ top: 12, right: 12, left: 4, bottom: 12 }}
                  barCategoryGap={18}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="계획" fill="#eab308" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="계획" position="top" formatter={(v: number) => `${v}`} />
                  </Bar>
                  <Bar dataKey="실제" fill="#22c55e" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="실제" position="top" formatter={(v: number) => `${v}`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* 최근 7일 계획 vs 실제 */}
        <Panel title="최근 7일 계획 vs 실제">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stat.last7}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar name="계획(분)" dataKey="plan" fill="#6d98d2" />
              <Bar name="실제(분)" dataKey="actual" fill="#31674a" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* 최근 7일 실천율 */}
        <Panel title="최근 7일 실천율(%)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stat.last7}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 150]} />
              <Tooltip />
              <Line type="monotone" dataKey="ratio" stroke="#16a34a" name="실천율(%)" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* 이번 주 과목별 계획 vs 실제 */}
        <Panel title="이번 주 과목별 계획 vs 실제">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stat.subjectWeek}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="subject" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="plan" name="계획(분)" fill="#6d98d2" />
              <Bar dataKey="actual" name="실제(분)" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* 최근 7일 시간대별 실제 */}
        <Panel title="최근 7일 시간대별 실제(집중도)">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={stat.timeOfDay}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="actual" stroke="#f59e0b" fill="url(#colorActual)" name="실제(분)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* 최근 7일 세션 요약 */}
        <Panel title="최근 7일 세션 요약">
          <div className="grid grid-cols-3 gap-4">
            <SmallCard title="세션 수" value={`${stat.habit.sessionCount7d}회`} />
            <SmallCard title="평균 세션 길이" value={`${stat.habit.avgSessionMin}분`} />
            <SmallCard title="연속 공부일" value={`${stat.habit.streakDays}일`} />
          </div>
        </Panel>
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
function SmallCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-gray-700">{title}</div>
      {children}
    </section>
  );
}
