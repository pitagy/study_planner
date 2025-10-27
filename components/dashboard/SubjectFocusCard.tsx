'use client';
import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import * as SB from '@/lib/supabaseClient';
import dayjs from 'dayjs';

const COLORS = ['#60a5fa', '#34d399', '#f472b6', '#facc15', '#a78bfa', '#f97316', '#22d3ee'];

const pickSupabase = () => typeof (SB as any).getSupabaseBrowser === 'function'
  ? (SB as any).getSupabaseBrowser()
  : (SB as any).getSupabaseClient();

export default function SubjectFocusCard({ viewerId }: { viewerId: string }) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => { if (viewerId) loadData(); }, [viewerId]);

  const loadData = async () => {
    const { data } = await supabase.from('sessions')
      .select('subject,duration_min').eq('user_id', viewerId).not('subject', 'is', null);
    const map = new Map<string, number>();
    (data || []).forEach(s => {
      const subj = s.subject || '기타';
      map.set(subj, (map.get(subj) || 0) + (s.duration_min ?? 0));
    });
    const arr = Array.from(map.entries()).map(([k, v]) => ({ name: k, value: v }));
    setData(arr);
  };

  if (!data.length) return null;

  return (
    <Card><CardContent className="p-4">
      <h3 className="font-semibold mb-2">📚 과목별 공부 비율</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={90}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </CardContent></Card>
  );
}
