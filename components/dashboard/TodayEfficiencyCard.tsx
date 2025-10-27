'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

export default function TodayEfficiencyCard({ viewerId }: { viewerId: string }) {
  const [data, setData] = useState<any[]>([]);
  const [efficiency, setEfficiency] = useState(0);
  const [message, setMessage] = useState('');

  const supabase = getSupabaseBrowser();
  const today = dayjs().format('YYYY-MM-DD');

  useEffect(() => {
    if (viewerId) loadData();
  }, [viewerId]);

  const loadData = async () => {
    // 🔹 계획 데이터 불러오기
    const { data: plans } = await supabase
      .from('plans')
      .select('subject, start_at, end_at')
      .eq('user_id', viewerId)
      .gte('start_at', today)
      .lt('start_at', dayjs(today).add(1, 'day').format('YYYY-MM-DD'));

    // 🔹 실제 공부 데이터 불러오기
    const { data: sessions } = await supabase
      .from('sessions')
      .select('subject, actual_start, actual_end, duration_min')
      .eq('user_id', viewerId)
      .gte('actual_start', today)
      .lt('actual_start', dayjs(today).add(1, 'day').format('YYYY-MM-DD'));

    // 🔹 과목별 총 시간 계산
    const subjectMap: Record<string, { plan: number; actual: number }> = {};

    (plans || []).forEach((p) => {
      const subject = p.subject || '기타';
      const diff = dayjs(p.end_at).diff(dayjs(p.start_at), 'minute');
      subjectMap[subject] = subjectMap[subject] || { plan: 0, actual: 0 };
      subjectMap[subject].plan += diff;
    });

    (sessions || []).forEach((s) => {
      const subject = s.subject || '기타';
      const dur = s.duration_min || 0;
      subjectMap[subject] = subjectMap[subject] || { plan: 0, actual: 0 };
      subjectMap[subject].actual += dur;
    });

    // 🔹 그래프용 데이터 생성
    const chartData = Object.entries(subjectMap).map(([subject, value]) => ({
      subject,
      계획: Math.round(value.plan / 60 * 10) / 10, // 시간 단위 (소수1자리)
      실제: Math.round(value.actual / 60 * 10) / 10, // 시간 단위 (소수1자리)
      효율: value.plan > 0 ? Math.round((value.actual / value.plan) * 100) : 0,
    }));

    setData(chartData);

    // 🔹 총 효율 계산
    const totalPlan = Object.values(subjectMap).reduce((acc, cur) => acc + cur.plan, 0);
    const totalActual = Object.values(subjectMap).reduce((acc, cur) => acc + cur.actual, 0);
    const eff = totalPlan > 0 ? Math.round((totalActual / totalPlan) * 100) : 0;
    setEfficiency(eff);

    if (eff < 40) setMessage('저조한 편이에요. 조금 더 화이팅!');
    else if (eff < 80) setMessage('양호한 편이에요. 꾸준히 유지해봐요!');
    else setMessage('대단해요! 오늘 정말 열심히 했어요!');
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <h2 className="font-semibold text-lg mb-3">⚡ 오늘의 실천 효율</h2>

        {data.length === 0 ? (
          <p className="text-gray-500 text-sm">오늘의 학습 데이터가 없습니다.</p>
        ) : (
          <>
            {/* 막대그래프 */}
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <XAxis dataKey="subject" />
                  <YAxis label={{ value: '시간(시간 단위)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(val) => `${val}시간`} />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="계획" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="실제" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 효율 표시 */}
            <div className="text-center mt-4">
              <p className="text-3xl font-bold text-indigo-600">{efficiency}%</p>
              <p className="text-gray-600 text-sm">{message}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
