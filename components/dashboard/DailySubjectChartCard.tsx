'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import * as SB from '@/lib/supabaseClient';
import dayjs from 'dayjs';

const pickSupabase = () =>
  typeof (SB as any).getSupabaseBrowser === 'function'
    ? (SB as any).getSupabaseBrowser()
    : (SB as any).getSupabaseClient();

/** ✅ 분 → "00시간 00분" */
const formatTime = (minutes: number) => {
  const h = Math.floor((minutes ?? 0) / 60);
  const m = (minutes ?? 0) % 60;
  return `${String(h).padStart(2, '0')}시간 ${String(m).padStart(2, '0')}분`;
};

/** ✅ 툴팁 */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    const plan = payload.find((p: any) => p.dataKey === '계획')?.value ?? 0;
    const actual = payload.find((p: any) => p.dataKey === '실제')?.value ?? 0;

    return (
      <div className="bg-white border border-gray-300 rounded p-2 text-sm shadow-md">
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-purple-600">계획: {formatTime(plan)}</p>
        <p className="text-blue-600">실제: {formatTime(actual)}</p>
      </div>
    );
  }
  return null;
};

export default function DailySubjectChartCard({
  viewerId,
  selectedDate,
}: {
  viewerId: string;
  selectedDate: string;
}) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (viewerId && selectedDate) loadChartData();
  }, [viewerId, selectedDate]);

  const loadChartData = async () => {
    try {
      // ✅ 1️⃣ plans_kst_view에서 과목별 계획 공부시간 합계
      const { data: planData, error: planError } = await supabase
        .from('plans_kst_view')
        .select('subject, start_kst, end_kst, date_kst')
        .eq('user_id', viewerId)
        .eq('date_kst', selectedDate);

      if (planError) throw planError;

      const planMap: Record<string, number> = {};
      (planData || []).forEach((p) => {
        const durationMin = (dayjs(p.end_kst).diff(dayjs(p.start_kst), 'minute')) || 0;
        planMap[p.subject || '기타'] = (planMap[p.subject || '기타'] || 0) + durationMin;
      });

      // ✅ 2️⃣ sessions_kst_view에서 과목별 실제 공부시간 합계
      const { data: sessData, error: sessError } = await supabase
        .from('sessions_kst_view')
        .select('subject, duration_min, date_kst')
        .eq('user_id', viewerId)
        .eq('date_kst', selectedDate);

      if (sessError) throw sessError;

      const actMap: Record<string, number> = {};
      (sessData || []).forEach((s) => {
        actMap[s.subject || '기타'] = (actMap[s.subject || '기타'] || 0) + (s.duration_min ?? 0);
      });

      // ✅ 3️⃣ 병합하여 차트 데이터 구성
      const allSubjects = Array.from(new Set([...Object.keys(planMap), ...Object.keys(actMap)]));

      const merged = allSubjects.map((sub) => ({
        과목: sub,
        계획: planMap[sub] || 0,
        실제: actMap[sub] || 0,
      }));

      setChartData(merged);
    } catch (err) {
      console.error('[DailySubjectChartCard] Error:', err);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold mb-2">📊 과목별 공부시간 비교</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="과목" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="계획" fill="#a78bfa" name="계획 시간" barSize={40} />
            <Bar dataKey="실제" fill="#60a5fa" name="실제 시간" barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
