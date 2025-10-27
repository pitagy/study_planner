'use client';
import { useEffect, useMemo, useState } from 'react';
import * as SB from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import dayjs from 'dayjs';

const pickSupabase = () => typeof (SB as any).getSupabaseBrowser === 'function'
  ? (SB as any).getSupabaseBrowser()
  : (SB as any).getSupabaseClient();

export default function FocusGaugeCard({ viewerId }: { viewerId: string }) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [focusRate, setFocusRate] = useState<number | null>(null);

  useEffect(() => { if (viewerId) loadData(); }, [viewerId]);

  const loadData = async () => {
    const today = dayjs();
    const start = today.startOf('day');
    const end = today.endOf('day');

    const [plansRes, sessRes] = await Promise.all([
      supabase.from('plans').select('start_at,end_at').eq('user_id', viewerId)
        .gte('start_at', start.toISOString()).lte('end_at', end.toISOString()),
      supabase.from('sessions').select('actual_start,actual_end,duration_min').eq('user_id', viewerId)
        .gte('actual_start', start.toISOString()).lte('actual_end', end.toISOString()),
    ]);
    const plans = plansRes.data || [], sessions = sessRes.data || [];

    const plan = plans.reduce((s, p) => s + dayjs(p.end_at).diff(dayjs(p.start_at), 'minute'), 0);
    const act = sessions.reduce((s, p) => s + (p.duration_min ?? 0), 0);
    setFocusRate(plan ? Math.round((act / plan) * 100) : 0);
  };

  if (focusRate === null) return null;
  return (
    <Card><CardContent className="p-4 text-center">
      <h3 className="font-semibold mb-2">🎯 오늘 집중 실천율</h3>
      <p className="text-4xl font-bold text-green-600">{focusRate}%</p>
      <p className="text-sm text-gray-500">
        {focusRate < 40 ? '조금 더 힘내요!' :
         focusRate < 80 ? '좋아요, 조금만 더!' :
         '최고예요! 멋져요!'}
      </p>
    </CardContent></Card>
  );
}
