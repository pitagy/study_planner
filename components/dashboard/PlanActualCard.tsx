'use client';
import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import * as SB from '@/lib/supabaseClient';
import dayjs from 'dayjs';

const pickSupabase = () => typeof (SB as any).getSupabaseBrowser === 'function'
  ? (SB as any).getSupabaseBrowser()
  : (SB as any).getSupabaseClient();

export default function PlanActualCard({ viewerId }: { viewerId: string }) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => { if (viewerId) loadData(); }, [viewerId]);

  const loadData = async () => {
    const start = dayjs().startOf('week').add(1, 'day');
    const end = start.add(6, 'day');

    const [plansRes, sessRes] = await Promise.all([
      supabase.from('plans').select('start_at,end_at').eq('user_id', viewerId)
        .gte('start_at', start.toISOString()).lte('end_at', end.toISOString()),
      supabase.from('sessions').select('actual_start,actual_end,duration_min').eq('user_id', viewerId)
        .gte('actual_start', start.toISOString()).lte('actual_end', end.toISOString()),
    ]);
    const plans = plansRes.data || [], sessions = sessRes.data || [];

    const result: any[] = [];
    for (let i = 0; i < 7; i++) {
      const day = start.add(i, 'day');
      const planMin = plans.filter(p => dayjs(p.start_at).isSame(day, 'day'))
        .reduce((s, p) => s + dayjs(p.end_at).diff(dayjs(p.start_at), 'minute'), 0);
      const actMin = sessions.filter(s => dayjs(s.actual_start).isSame(day, 'day'))
        .reduce((s, v) => s + (v.duration_min ?? 0), 0);
      result.push({ 요일: day.format('ddd'), 계획: +(planMin / 60).toFixed(1), 실제: +(actMin / 60).toFixed(1) });
    }
    setData(result);
  };

  if (!data.length) return null;

  return (
    <Card><CardContent className="p-4">
      <h3 className="font-semibold mb-2">📅 이번 주 계획 vs 실제</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}><XAxis dataKey="요일" /><YAxis unit="h" /><Tooltip />
          <Bar dataKey="계획" fill="#a78bfa" barSize={40} />
          <Bar dataKey="실제" fill="#34d399" barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </CardContent></Card>
  );
}
