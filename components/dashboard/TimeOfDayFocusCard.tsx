'use client';
import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import * as SB from '@/lib/supabaseClient';

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

/** ✅ 툴팁(그래프/데이터 구조는 유지) */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    const value = payload[0]?.value ?? 0; // 분 단위
    return (
      <div className="bg-white border border-gray-300 rounded p-2 text-sm shadow-md">
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-blue-600">{`공부시간 : ${formatTime(value)}`}</p>
      </div>
    );
  }
  return null;
};

export default function TimeOfDayFocusCard({ viewerId }: { viewerId: string }) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (viewerId) loadData();
  }, [viewerId]);

  const loadData = async () => {
    const { data } = await supabase
      .from('sessions')
      .select('actual_start,duration_min')
      .eq('user_id', viewerId);

    const map = new Map<number, number>();
    (data || []).forEach((s) => {
      const h = new Date(s.actual_start).getHours();
      map.set(h, (map.get(h) || 0) + (s.duration_min ?? 0));
    });

    const arr = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([h, v]) => ({ 시간대: `${h}시`, 분: v }));

    setData(arr);
  };

  if (!data.length) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold mb-2">🕒 시간대별 집중 패턴</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <XAxis dataKey="시간대" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="분" stroke="#34d399" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
