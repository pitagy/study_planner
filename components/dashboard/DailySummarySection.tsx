'use client';

import { useEffect, useMemo, useState } from 'react';
import * as SB from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
dayjs.locale('ko');

const pickSupabase = () =>
  typeof (SB as any).getSupabaseBrowser === 'function'
    ? (SB as any).getSupabaseBrowser()
    : (SB as any).getSupabaseClient();

/** ✅ 시간을 "00시간 00분" 형식으로 변환 */
const formatTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}시간 ${String(m).padStart(2, '0')}분`;
};

export default function DailySummarySection({
  viewerId,
  selectedDate,
}: {
  viewerId: string;
  selectedDate: string;
}) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [data, setData] = useState<any[]>([]);
  const [planMin, setPlanMin] = useState(0);
  const [actualMin, setActualMin] = useState(0);
  const [rate, setRate] = useState(0);

  /** ✅ 선택한 날짜의 학습 계획 및 실제 시간 불러오기 */
  useEffect(() => {
    if (viewerId && selectedDate) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerId, selectedDate]);

  const loadData = async () => {
    const dateStart = dayjs(selectedDate).startOf('day').toISOString();
    const dateEnd = dayjs(selectedDate).endOf('day').toISOString();

    try {
      /** 1️⃣ 계획 공부 시간 */
      const { data: plans, error: planErr } = await supabase
        .from('plans')
        .select('start_at, end_at, subject')
        .eq('user_id', viewerId)
        .gte('start_at', dateStart)
        .lte('end_at', dateEnd);

      if (planErr) console.error('❌ 계획 조회 오류:', planErr);

      const subjectMap: Record<string, number> = {};
      let totalPlan = 0;
      plans?.forEach((p) => {
        const diff = dayjs(p.end_at).diff(dayjs(p.start_at), 'minute');
        const subj = p.subject || '기타';
        subjectMap[subj] = (subjectMap[subj] || 0) + diff;
        totalPlan += diff;
      });

      /** 2️⃣ 실제 공부 시간 */
      const { data: sessions, error: sessErr } = await supabase
        .from('sessions')
        .select('duration_min, actual_start, actual_end, subject')
        .eq('user_id', viewerId)
        .gte('actual_start', dateStart)
        .lte('actual_end', dateEnd);

      if (sessErr) console.error('❌ 실제 공부 조회 오류:', sessErr);

      const actualMap: Record<string, number> = {};
      let totalActual = 0;
      sessions?.forEach((s) => {
        const subj = s.subject || '기타';
        actualMap[subj] = (actualMap[subj] || 0) + (s.duration_min ?? 0);
        totalActual += s.duration_min ?? 0;
      });

      const merged = Object.keys({ ...subjectMap, ...actualMap }).map((subj) => ({
        과목: subj,
        계획: Math.round((subjectMap[subj] || 0) / 60),
        실제: Math.round((actualMap[subj] || 0) / 60),
      }));

      setData(merged);
      setPlanMin(totalPlan);
      setActualMin(totalActual);
      setRate(totalPlan ? Math.round((totalActual / totalPlan) * 100) : 0);
    } catch (err) {
      console.error('[DailySummarySection] Error:', err);
    }
  };

  /** ✅ 커스텀 툴팁 */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const plan = payload.find((p: any) => p.dataKey === '계획')?.value ?? 0;
      const actual = payload.find((p: any) => p.dataKey === '실제')?.value ?? 0;
      return (
        <div className="bg-white border border-gray-300 rounded p-2 text-sm shadow-md">
          <p className="font-semibold mb-1">{label}</p>
          <p className="text-blue-600">{`계획 공부시간: ${formatTime(plan * 60)}`}</p>
          <p className="text-emerald-600">{`실제 공부시간: ${formatTime(actual * 60)}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
      <CardContent className="p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          📊 일일 학습 요약 ({dayjs(selectedDate).format('M월 D일')})
        </h2>

        {/* ✅ 계획 vs 실제 그래프 */}
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <XAxis dataKey="과목" />
            <YAxis unit="h" />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="계획" fill="#a78bfa" barSize={40} />
            <Bar dataKey="실제" fill="#34d399" barSize={40} />
          </BarChart>
        </ResponsiveContainer>

        {/* ✅ 총합 및 실천율 */}
        <div className="text-gray-700 leading-relaxed text-sm mt-3">
          계획 공부 시간:{' '}
          <span className="font-semibold text-blue-600">
            {formatTime(planMin)}
          </span>
          <br />
          실제 공부 시간:{' '}
          <span className="font-semibold text-emerald-600">
            {formatTime(actualMin)}
          </span>
          <br />
          실천율:{' '}
          <span className="font-semibold text-indigo-600">{rate}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
