'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import * as SB from '@/lib/supabaseClient';
import dayjs from 'dayjs';

const pickSupabase = () =>
  typeof (SB as any).getSupabaseBrowser === 'function'
    ? (SB as any).getSupabaseBrowser()
    : (SB as any).getSupabaseClient();

export default function AccumulatedFocusCard({ viewerId }: { viewerId: string }) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [totalMin, setTotalMin] = useState(0);

  useEffect(() => { if (viewerId) loadData(); }, [viewerId]);

  const loadData = async () => {
    const { data } = await supabase.from('sessions').select('duration_min').eq('user_id', viewerId);
    const sum = (data || []).reduce((acc, s) => acc + (s.duration_min ?? 0), 0);
    setTotalMin(sum);
  };

  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  return (
    <Card><CardContent className="p-4 text-center">
      <h3 className="font-semibold mb-2">🔥 누적 공부시간</h3>
      <p className="text-3xl font-bold text-blue-600">{h}시간 {m}분</p>
    </CardContent></Card>
  );
}
