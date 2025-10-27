'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Seoul');

type Props = {
  viewerId: string;
  selectedDate: string;
};

type SummaryItem = {
  subject: string;
  planned: number;
  actual: number;
};

export default function DailySummarySection({ viewerId, selectedDate }: Props) {
  const supabase = getSupabaseClient();
  const [data, setData] = useState<SummaryItem[]>([]);
  const [totalPlan, setTotalPlan] = useState(0);
  const [totalActual, setTotalActual] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDailySummary = async () => {
    if (!viewerId || !selectedDate) return;
    setLoading(true);

    const start = dayjs(selectedDate).tz().startOf('day').toISOString();
    const end = dayjs(selectedDate).tz().endOf('day').toISOString();

    try {
      const [plansRes, sessRes] = await Promise.all([
        supabase
          .from('plans')
          .select('subject, start_at, end_at')
          .eq('user_id', viewerId)
          // 🔹 수정 핵심: 오늘 날짜와 "겹치는" 계획은 모두 포함
          .or(`and(start_at.lte.${end},end_at.gte.${start})`),

        supabase
          .from('sessions')
          .select('subject, actual_start, actual_end, duration_min')
          .eq('user_id', viewerId)
          .gte('actual_start', start)
          .lte('actual_end', end),
      ]);

      if (plansRes.error) throw plansRes.error;
      if (sessRes.error) throw sessRes.error;

      const plans = plansRes.data ?? [];
      const sessions = sessRes.data ?? [];

      // 📊 과목별 집계
      const pMap: Record<string, number> = {};
      const aMap: Record<string, number> = {};

      plans.forEach((p) => {
        const subj = p.subject || '기타';
        const dur = dayjs(p.end_at).diff(dayjs(p.start_at), 'minute');
        pMap[subj] = (pMap[subj] || 0) + Math.max(0, dur);
      });

      sessions.forEach((s) => {
        const subj = s.subject || '기타';
        aMap[subj] = (aMap[subj] || 0) + (s.duration_min ?? 0);
      });

      const allSubjects = Array.from(new Set([...Object.keys(pMap), ...Object.keys(aMap)]));
      const summaryArr: SummaryItem[] = allSubjects.map((subj) => ({
        subject: subj,
        planned: pMap[subj] || 0,
        actual: aMap[subj] || 0,
      }));

      // ✅ 전체합
      const totalPlanMin = summaryArr.reduce((acc, cur) => acc + cur.planned, 0);
      const totalActualMin = summaryArr.reduce((acc, cur) => acc + cur.actual, 0);

      setData(summaryArr);
      setTotalPlan(totalPlanMin);
      setTotalActual(totalActualMin);
    } catch (err) {
      console.error('❌ DailySummarySection Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailySummary();
  }, [viewerId, selectedDate]);

  if (loading) return <p className="text-gray-400 text-sm mt-3">불러오는 중...</p>;

  if (data.length === 0)
    return <p className="text-gray-400 text-sm mt-3">이 날짜에 학습 데이터가 없습니다.</p>;

  const efficiency = totalPlan > 0 ? Math.round((totalActual / totalPlan) * 100) : 0;

  return (
    <div className="mt-4 p-4 bg-white rounded-xl border shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-md font-semibold">과목별 학습 분석</h3>
        <span className="text-sm text-gray-600">
          총 계획 {Math.round(totalPlan / 60)}시간 / 실천 {Math.round(totalActual / 60)}시간 (
          효율 {efficiency}%)
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <XAxis dataKey="subject" />
          <YAxis />
          <Tooltip
            formatter={(value: number) => `${Math.round(value)}분`}
            labelStyle={{ fontWeight: 'bold' }}
          />
          <Bar dataKey="planned" name="계획" fill="#cbd5e1">
            {data.map((entry, index) => (
              <Cell key={`plan-${index}`} />
            ))}
          </Bar>
          <Bar dataKey="actual" name="실제" fill="#60a5fa">
            {data.map((entry, index) => (
              <Cell key={`actual-${index}`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
