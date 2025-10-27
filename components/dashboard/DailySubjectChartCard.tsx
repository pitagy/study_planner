'use client';

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts';

const COLOR_PLAN = '#a5b4fc';
const COLOR_ACTUAL = '#6366f1';

export default function DailySubjectChartCard({ supabase, viewerId, selectedDate }: any) {
  const [data, setData] = useState<any[]>([]);
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (viewerId && selectedDate) loadData(selectedDate);
  }, [viewerId, selectedDate]);

  const loadData = async (date: string) => {
    const start = dayjs(date).startOf('day').toISOString();
    const end = dayjs(date).endOf('day').toISOString();
    setLabel(dayjs(date).format('YYYY년 M월 D일 (ddd)'));

    const [plansRes, sessionsRes] = await Promise.all([
      supabase
        .from('plans')
        .select('subject,start_at,end_at')
        .eq('user_id', viewerId)
        .gte('start_at', start)
        .lte('end_at', end),
      supabase
        .from('sessions')
        .select('subject,actual_start,actual_end,duration_min')
        .eq('user_id', viewerId)
        .gte('actual_start', start)
        .lte('actual_end', end),
    ]);

    const plans = plansRes.data || [];
    const sessions = sessionsRes.data || [];

    const pMap: Record<string, number> = {};
    plans.forEach((p) => {
      const subj = p.subject || '기타';
      const dur = dayjs(p.end_at).diff(dayjs(p.start_at), 'minute');
      pMap[subj] = (pMap[subj] || 0) + Math.max(0, dur);
    });

    const sMap: Record<string, number> = {};
    sessions.forEach((s) => {
      const subj = s.subject || '기타';
      const dur = s.duration_min ?? dayjs(s.actual_end).diff(dayjs(s.actual_start), 'minute');
      sMap[subj] = (sMap[subj] || 0) + Math.max(0, dur);
    });

    const subjects = Array.from(new Set([...Object.keys(pMap), ...Object.keys(sMap)]));
    const merged = subjects.map((subj) => ({
      subject: subj,
      계획: Math.round(pMap[subj] || 0),
      실제: Math.round(sMap[subj] || 0),
    }));

    setData(merged);
  };

  return (
    <section className="bg-white rounded-lg border p-4 shadow-sm">
      <h2 className="font-semibold mb-2">📊 {label || '날짜를 선택하세요'}</h2>
      {data.length === 0 ? (
        <p className="text-gray-400 text-sm">
          {selectedDate ? '해당 날짜의 학습 기록이 없습니다.' : '히트맵에서 날짜를 선택하세요.'}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="subject" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="계획" fill={COLOR_PLAN}>
              <LabelList dataKey="계획" position="top" />
            </Bar>
            <Bar dataKey="실제" fill={COLOR_ACTUAL}>
              <LabelList dataKey="실제" position="top" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
