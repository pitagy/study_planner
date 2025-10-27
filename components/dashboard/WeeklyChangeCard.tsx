'use client';
import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import * as SB from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';   // ✅ 추가
dayjs.extend(weekOfYear);                           // ✅ 활성화

const pickSupabase = () =>
  typeof (SB as any).getSupabaseBrowser === 'function'
    ? (SB as any).getSupabaseBrowser()
    : (SB as any).getSupabaseClient();

export default function WeeklyChangeCard({ viewerId }: { viewerId: string }) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => { if (viewerId) loadData(); }, [viewerId]);

  const loadData = async () => {
    const today = dayjs();
    const start = today.startOf('week').add(1, 'day').subtract(3, 'week'); // 최근 4주
    const { data } = await supabase.from('sessions')
      .select('actual_start,duration_min')
      .eq('user_id', viewerId)
      .gte('actual_start', start.toISOString());

    const weeks = new Map<string, number>();
    (data || []).forEach((s) => {
      const wk = dayjs(s.actual_start).week(); // ✅ 이제 정상 작동
      weeks.set(wk.toString(), (weeks.get(wk.toString()) || 0) + (s.duration_min ?? 0));
    });

    const arr = Array.from(weeks.entries())
      .map(([w, v]) => ({ 주차: `${w}주`, 분: Math.round(v) }))
      .sort((a, b) => parseInt(a.주차) - parseInt(b.주차));

    setData(arr);
  };

  if (!data.length) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold mb-2">📈 주간 공부 추이</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <XAxis dataKey="주차" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="분" stroke="#60a5fa" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
