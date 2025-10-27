// hooks/useDashboardData.ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/ko';
import * as SB from '@/lib/supabaseClient';

dayjs.extend(utc);
dayjs.locale('ko');

const pickSupabase = () =>
  typeof (SB as any).getSupabaseBrowser === 'function'
    ? (SB as any).getSupabaseBrowser()
    : (SB as any).getSupabaseClient();

export interface DashboardData {
  todayCompare: any[];
  weeklyTotal: any[];
  weeklySub: any[];
  focusTime: any[];
  subjectPie: any[];
  monthMapArr: any[];
  noteDays: string[];
}

export function useDashboardData(viewerId: string | null) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!viewerId) return;
    fetchDashboard(viewerId);
  }, [viewerId]);

  const fetchDashboard = async (viewerId: string) => {
    setLoading(true);
    const today = dayjs();
    const start30 = today.subtract(29, 'day').startOf('day');
    const end = today.endOf('day');

    const { data: sessions } = await supabase
      .from('sessions')
      .select('subject, actual_start, actual_end, duration_min')
      .eq('user_id', viewerId)
      .gte('actual_start', start30.toISOString())
      .lte('actual_end', end.toISOString());

    const { data: plans } = await supabase
      .from('plans')
      .select('subject, start_at, end_at')
      .eq('user_id', viewerId)
      .gte('start_at', start30.toISOString())
      .lte('end_at', end.toISOString());

    const todayStr = today.format('YYYY-MM-DD');
    const planToday = plans.filter(p => dayjs(p.start_at).format('YYYY-MM-DD') === todayStr);
    const sessToday = sessions.filter(s => dayjs(s.actual_start).format('YYYY-MM-DD') === todayStr);
    const todayCompare = mergeSubjectCompare(planToday, sessToday);

    const weeklyTotal = Array.from({ length: 7 }).map((_, i) => {
      const d = today.subtract(6 - i, 'day');
      const planM = plans
        .filter(p => dayjs(p.start_at).isSame(d, 'day'))
        .reduce((a, b) => a + dayjs(b.end_at).diff(dayjs(b.start_at), 'minute'), 0);
      const sessM = sessions
        .filter(s => dayjs(s.actual_start).isSame(d, 'day'))
        .reduce((a, b) => a + (b.duration_min ?? 0), 0);
      return { 날짜: d.format('MM/DD'), 계획: planM, 실제: sessM };
    });

    const planSub = groupBy(plans, 'subject');
    const sessSub = groupBy(sessions, 'subject');
    const weeklySub = Object.keys({ ...planSub, ...sessSub }).map(k => ({
      subject: k,
      계획: planSub[k] || 0,
      실제: sessSub[k] || 0,
    }));

    const focus = { 오전: 0, 오후: 0, 야간: 0 };
    sessions.forEach(s => {
      const h = dayjs(s.actual_start).hour();
      if (h < 12) focus.오전 += s.duration_min;
      else if (h < 18) focus.오후 += s.duration_min;
      else focus.야간 += s.duration_min;
    });
    const focusTime = Object.entries(focus).map(([k, v]) => ({ 시간대: k, 집중도: v }));
    const subjectPie = Object.entries(sessSub).map(([k, v]) => ({ name: k, value: v }));

    const monthMapArr = Array.from({ length: 30 }).map((_, i) => {
      const d = start30.add(i, 'day');
      const sessM = sessions
        .filter(s => dayjs(s.actual_start).isSame(d, 'day'))
        .reduce((a, b) => a + (b.duration_min ?? 0), 0);
      return { date: d.format('YYYY-MM-DD'), minutes: sessM };
    });

    const { data: notes } = await supabase
      .from('dashboard_notes')
      .select('date')
      .eq('user_id', viewerId);
    const noteDays = notes?.map(n => n.date) ?? [];

    setData({ todayCompare, weeklyTotal, weeklySub, focusTime, subjectPie, monthMapArr, noteDays });
    setLoading(false);
  };

  return { data, loading };
}

function groupBy(arr: any[], key: string) {
  const res: Record<string, number> = {};
  arr.forEach(a => {
    const k = a[key] ?? '기타';
    res[k] = (res[k] || 0) + (a.duration_min ?? dayjs(a.end_at).diff(dayjs(a.start_at), 'minute'));
  });
  return res;
}
function mergeSubjectCompare(plan: any[], sess: any[]) {
  const planMap = groupBy(plan, 'subject');
  const sessMap = groupBy(sess, 'subject');
  return Object.keys({ ...planMap, ...sessMap }).map(k => ({
    subject: k,
    계획: planMap[k] || 0,
    실제: sessMap[k] || 0,
    달성률: planMap[k] ? Math.round(((sessMap[k] || 0) / planMap[k]) * 100) : 0,
  }));
}
