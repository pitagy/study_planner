'use client';

import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import * as SB from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear'; // ✅ 추가
dayjs.extend(weekOfYear); // ✅ 플러그인 등록

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

export default function WeeklySummaryCard({ viewerId }: { viewerId: string }) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (viewerId) loadData();
  }, [viewerId]);

  const loadData = async () => {
    const start = dayjs().subtract(6, 'week').startOf('week').add(1, 'day');
    const { data, error } = await supabase
      .from('sessions')
      .select('actual_start,duration_min')
      .eq('user_id', viewerId)
      .gte('actual_start', start.toISOString());

    if (error) return console.error(error);

    const weekMap = new Map<string, number>();
    data?.forEach((s) => {
      const week = dayjs(s.actual_start).week(); // ✅ 이제 정상 작동
      weekMap.set(week.toString(), (weekMap.get(week.toString()) || 0) + (s.duration_min || 0));
    });

    const result = Array.from(weekMap.entries())
      .map(([week, mins]) => ({
        주차: `${week}주`,
        공부시간: mins,
      }))
      .sort((a, b) => parseInt(a.주차) - parseInt(b.주차));

    setData(result);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const value = payload[0].value ?? 0;
      return (
        <div className="bg-white border border-gray-300 rounded p-2 text-sm shadow-md">
          <p className="font-semibold mb-1">{label}</p>
          <p className="text-blue-600">{`공부시간: ${formatTime(value)}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold mb-2">📈 주간 공부 요약</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <XAxis dataKey="주차" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="공부시간" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
