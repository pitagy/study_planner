'use client';
import { useEffect, useState, useRef } from 'react';
import dayjs from 'dayjs';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  Legend,
} from 'recharts';

const COLOR_PLAN = '#0d9488';   // Teal (계획)
const COLOR_ACTUAL = '#f97316'; // Orange (실제)

export default function DailySummarySection({ supabase, viewerId, selectedDate }: any) {
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const prevDateRef = useRef<string>('');
  const dateStr = selectedDate || dayjs().format('YYYY-MM-DD');

  useEffect(() => {
    const loadSummary = async () => {
      if (prevDateRef.current === dateStr && summaryData.length > 0) return;

      const start = dayjs(dateStr).startOf('day').toISOString();
      const end = dayjs(dateStr).endOf('day').toISOString();

      const [plansRes, sessRes] = await Promise.all([
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
      const sessions = sessRes.data || [];
      const merged = mergeSubjectCompare(plans, sessions);
      setSummaryData(merged);
      prevDateRef.current = dateStr;
    };

    if (viewerId) loadSummary();
  }, [viewerId, dateStr]);

  return (
    <section className="bg-white rounded-xl p-4 border transition-all duration-300">
      <h2 className="font-semibold mb-2">📊 {dayjs(dateStr).format('M월 D일')}의 학습 요약</h2>

      <div className="relative w-full h-[260px] flex items-center justify-center">
        {summaryData.length === 0 ? (
          <p className="text-gray-400 text-sm">오늘의 학습 데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summaryData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="subject" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="계획" fill={COLOR_PLAN} opacity={0.9}>
                <LabelList
                  dataKey="계획"
                  position="top"
                  fill="#fff"
                  style={{ fontSize: 12, fontWeight: 500 }}
                />
              </Bar>
              <Bar dataKey="실제" fill={COLOR_ACTUAL} opacity={0.85}>
                <LabelList
                  dataKey="실제"
                  position="top"
                  fill="#fff"
                  style={{ fontSize: 12, fontWeight: 500 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function mergeSubjectCompare(plans: any[], sessions: any[]) {
  const pMap: Record<string, number> = {};
  const sMap: Record<string, number> = {};

  plans.forEach((p) => {
    const subj = p.subject || '기타';
    const dur = dayjs(p.end_at).diff(dayjs(p.start_at), 'minute');
    pMap[subj] = (pMap[subj] || 0) + Math.max(0, dur);
  });

  sessions.forEach((s) => {
    const subj = s.subject || '기타';
    const dur = s.duration_min ?? dayjs(s.actual_end).diff(dayjs(s.actual_start), 'minute');
    sMap[subj] = (sMap[subj] || 0) + Math.max(0, dur);
  });

  const subjects = Array.from(new Set([...Object.keys(pMap), ...Object.keys(sMap)]));
  return subjects.map((subj) => ({
    subject: subj,
    계획: pMap[subj] || 0,
    실제: sMap[subj] || 0,
    실천율: pMap[subj] ? Math.round(((sMap[subj] || 0) / pMap[subj]) * 100) : 0,
  }));
}
