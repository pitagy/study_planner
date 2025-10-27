'use client';
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import * as SB from '@/lib/supabaseClient';
import dayjs from 'dayjs';

const pickSupabase = () =>
  typeof (SB as any).getSupabaseBrowser === 'function'
    ? (SB as any).getSupabaseBrowser()
    : (SB as any).getSupabaseClient();

export default function WeeklySummaryCard({ viewerId }: { viewerId: string }) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [data, setData] = useState<{ plan: number; actual: number } | null>(null);

  useEffect(() => { if (viewerId) loadData(); }, [viewerId]);

  const loadData = async () => {
    const today = dayjs();
    const startOfWeek = today.startOf('week').add(1, 'day');
    const endOfWeek = startOfWeek.add(6, 'day');

    const [plansRes, sessRes] = await Promise.all([
      supabase.from('plans').select('start_at,end_at').eq('user_id', viewerId)
        .gte('start_at', startOfWeek.toISOString()).lte('end_at', endOfWeek.toISOString()),
      supabase.from('sessions').select('actual_start,actual_end,duration_min').eq('user_id', viewerId)
        .gte('actual_start', startOfWeek.toISOString()).lte('actual_end', endOfWeek.toISOString()),
    ]);
    const plans = plansRes.data || [], sessions = sessRes.data || [];

    const planMin = plans.reduce((sum, p) => sum + dayjs(p.end_at).diff(dayjs(p.start_at), 'minute'), 0);
    const actualMin = sessions.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);

    setData({ plan: +(planMin / 60).toFixed(1), actual: +(actualMin / 60).toFixed(1) });
  };

  if (!data) return null;
  const chartData = [
    { name: '계획', 시간: data.plan },
    { name: '실제', 시간: data.actual },
  ];

  return (
    <Card><CardContent className="p-4">
      <h3 className="font-semibold mb-2">📊 이번 주 공부 시간</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}><XAxis dataKey="name" /><YAxis unit="h" /><Tooltip />
          <Bar dataKey="시간" fill="#34d399" barSize={60} radius={[8,8,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </CardContent></Card>
  );
}
