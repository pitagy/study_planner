'use client';

import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import * as SB from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);
dayjs.locale('ko');

const pickSupabase = () =>
  typeof (SB as any).getSupabaseBrowser === 'function'
    ? (SB as any).getSupabaseBrowser()
    : (SB as any).getSupabaseClient();

/** ✅ 시간 변환 함수 (시·분 변환용) */
const formatTime = (hours: number) => {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
};

export default function PlanActualCard({ viewerId }: { viewerId: string }) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [data, setData] = useState<any[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekRange, setWeekRange] = useState('');

  /** ✅ 데이터 불러오기 */
  useEffect(() => {
    if (viewerId) loadData();
  }, [viewerId, weekOffset]);

  const loadData = async () => {
    const start = dayjs().startOf('week').add(1, 'day').add(weekOffset, 'week'); // 월요일 시작
    const end = start.add(6, 'day');
    setWeekRange(`${start.format('MM/DD')} ~ ${end.format('MM/DD')}`);

    const [plansRes, sessRes] = await Promise.all([
      supabase
        .from('plans')
        .select('start_at,end_at')
        .eq('user_id', viewerId)
        .gte('start_at', start.toISOString())
        .lte('end_at', end.toISOString()),
      supabase
        .from('sessions')
        .select('actual_start,actual_end,duration_min')
        .eq('user_id', viewerId)
        .gte('actual_start', start.toISOString())
        .lte('actual_end', end.toISOString()),
    ]);

    const plans = plansRes.data || [];
    const sessions = sessRes.data || [];

    const result: any[] = [];
    for (let i = 0; i < 7; i++) {
      const day = start.add(i, 'day');
      const planMin = plans
        .filter((p) => dayjs(p.start_at).isSame(day, 'day'))
        .reduce((s, p) => s + dayjs(p.end_at).diff(dayjs(p.start_at), 'minute'), 0);
      const actMin = sessions
        .filter((s) => dayjs(s.actual_start).isSame(day, 'day'))
        .reduce((s, v) => s + (v.duration_min ?? 0), 0);
      result.push({
        요일: day.format('ddd'), // 한글 요일 (월, 화, 수 ...)
        계획: +(planMin / 60).toFixed(2),
        실제: +(actMin / 60).toFixed(2),
      });
    }

    setData(result);
  };

  /** ✅ 주차 이동 함수 */
  const goPrevWeek = () => setWeekOffset((prev) => prev - 1);
  const goNextWeek = () => setWeekOffset((prev) => prev + 1);
  const goThisWeek = () => setWeekOffset(0);

  if (!data.length) return null;

  /** ✅ 커스텀 툴팁 */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const plan = payload.find((p: any) => p.dataKey === '계획')?.value ?? 0;
      const actual = payload.find((p: any) => p.dataKey === '실제')?.value ?? 0;
      return (
        <div className="bg-white border border-gray-300 rounded p-2 text-sm shadow-md">
          <p className="font-semibold mb-1">{`${label}요일`}</p>
          <p className="text-purple-500">{`계획 : ${formatTime(plan)}`}</p>
          <p className="text-emerald-500">{`실제 : ${formatTime(actual)}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        {/* 🔹 타이틀 & 주차 이동 버튼 */}
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-base">📅 주별 계획 vs 실제</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={goPrevWeek}
              className="text-sm px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition"
            >
              이전주
            </button>
            <button
              onClick={goThisWeek}
              className="text-sm px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition"
            >
              이번주
            </button>
            <button
              onClick={goNextWeek}
              className="text-sm px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition"
            >
              다음주
            </button>
          </div>
        </div>

        {/* 🔹 그래프 */}
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <XAxis dataKey="요일" />
            <YAxis unit="h" />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="계획" fill="#a78bfa" barSize={40} />
            <Bar dataKey="실제" fill="#34d399" barSize={40} />
          </BarChart>
        </ResponsiveContainer>

        {/* 🔹 주차 범위 표시 */}
        <div className="mt-3 text-center text-sm text-gray-600 font-medium">
          {`< ${weekRange} 주 계획 vs 실제 >`}
        </div>
      </CardContent>
    </Card>
  );
}
