'use client';
import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import * as SB from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
dayjs.extend(weekOfYear);

const pickSupabase = () =>
  typeof (SB as any).getSupabaseBrowser === 'function'
    ? (SB as any).getSupabaseBrowser()
    : (SB as any).getSupabaseClient();

/** ✅ 시간을 "00시간 00분" 형식으로 변환 */
const formatTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}시간 ${mm}분`;
};

export default function WeeklyChangeCard({ viewerId }: { viewerId: string }) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (viewerId) loadData();
  }, [viewerId]);

  const loadData = async () => {
    const today = dayjs();
    const start = today.startOf('week').add(1, 'day').subtract(3, 'week'); // 최근 4주

    const { data, error } = await supabase
      .from('sessions')
      .select('actual_start,duration_min')
      .eq('user_id', viewerId)
      .gte('actual_start', start.toISOString());

    if (error) {
      console.error('[WeeklyChangeCard] 데이터 로드 오류:', error);
      return;
    }

    const weeks = new Map<string, number>();
    (data || []).forEach((s) => {
      const wk = dayjs(s.actual_start).week();
      weeks.set(wk.toString(), (weeks.get(wk.toString()) || 0) + (s.duration_min ?? 0));
    });

    const arr = Array.from(weeks.entries())
      .map(([w, v]) => ({ 주차: `${w}주`, 분: Math.round(v) }))
      .sort((a, b) => parseInt(a.주차) - parseInt(b.주차));

    setData(arr);
  };

  if (!data.length) return null;

  /** ✅ 툴팁 커스텀 */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value ?? 0;
      return (
        <div className="bg-white border border-gray-300 rounded p-2 text-sm shadow-md">
          <p className="font-semibold mb-1">{label}</p>
          <p className="text-blue-600">{`공부시간 : ${formatTime(value)}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold mb-2">📈 주간 공부 추이</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <XAxis dataKey="주차" />
            <YAxis
              tickFormatter={(val) => {
                const h = Math.floor(val / 60);
                return `${h}h`; // Y축에는 간단히 시간만 표시
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="분" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
