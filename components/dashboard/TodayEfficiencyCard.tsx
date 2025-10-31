'use client';

import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import * as SB from '@/lib/supabaseClient';
import dayjs from 'dayjs';

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

export default function TodayEfficiencyCard({ viewerId }: { viewerId: string }) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (viewerId) loadData();
  }, [viewerId]);

  const loadData = async () => {
    const start = dayjs().startOf('day');
    const end = dayjs().endOf('day');

    const { data, error } = await supabase
      .from('sessions')
      .select('subject, duration_min')
      .eq('user_id', viewerId)
      .gte('actual_start', start.toISOString())
      .lte('actual_end', end.toISOString());

    if (error) return console.error(error);

    const subjectMap: Record<string, number> = {};
    (data || []).forEach((s) => {
      subjectMap[s.subject || '기타'] = (subjectMap[s.subject || '기타'] || 0) + (s.duration_min ?? 0);
    });

    const result = Object.entries(subjectMap).map(([sub, min]) => ({
      과목: sub,
      공부시간: min,
    }));

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
        <h3 className="font-semibold mb-2">🔥 오늘의 효율 분석</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <XAxis dataKey="과목" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="공부시간" fill="#60a5fa" barSize={45} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
