'use client';

import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import * as SB from '@/lib/supabaseClient';
import dayjs from 'dayjs';

const COLORS = ['#60a5fa', '#34d399', '#f472b6', '#facc15', '#a78bfa', '#f97316', '#22d3ee'];

const pickSupabase = () =>
  typeof (SB as any).getSupabaseBrowser === 'function'
    ? (SB as any).getSupabaseBrowser()
    : (SB as any).getSupabaseClient();

/** 🔹 파이차트 라벨 커스텀 함수 (분 + 시/분 병기) */
const renderCustomizedLabel = (props: any) => {
  const { cx, cy, midAngle, outerRadius, name, value } = props;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius * 1.25; // 🔸 안내선 길이 (조절 가능)
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  const totalMin = Math.round(value);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const displayTime =
    hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  return (
    <text
      x={x}
      y={y}
      fill="#333"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
    >
      {`${name} : ${totalMin}분 (${displayTime})`}
    </text>
  );
};

export default function SubjectFocusCard({ viewerId }: { viewerId: string }) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (viewerId) loadData();
  }, [viewerId]);

  /** ✅ 과목별 공부시간 불러오기 */
  const loadData = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('subject, duration_min')
      .eq('user_id', viewerId)
      .not('subject', 'is', null);

    if (error) {
      console.error('[SubjectFocusCard] 데이터 로드 오류:', error);
      return;
    }

    const map = new Map<string, number>();
    (data || []).forEach((s) => {
      const subj = s.subject || '기타';
      map.set(subj, (map.get(subj) || 0) + (s.duration_min ?? 0));
    });

    const arr = Array.from(map.entries()).map(([k, v]) => ({ name: k, value: v }));
    setData(arr);
  };

  if (!data.length) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold mb-2">📚 과목별 공부 비율</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius={90}
              labelLine
              label={renderCustomizedLabel}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => {
                const totalMin = Math.round(value);
                const h = Math.floor(totalMin / 60);
                const m = totalMin % 60;
                return [`${totalMin}분 (${h > 0 ? `${h}시간 ${m}분` : `${m}분`})`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
