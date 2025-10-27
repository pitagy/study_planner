'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type AIWeeklySummaryProps = {
  viewerId: string; // 🔹 외부에서 받는 유일한 props
};

export default function AIWeeklySummary({ viewerId }: AIWeeklySummaryProps) {
  const [summary, setSummary] = useState('');
  const [range, setRange] = useState('');
  const supabase = getSupabaseClient(); // 🔹 내부에서 supabase 생성

  useEffect(() => {
    if (!viewerId) return;

    const fetchSummary = async () => {
      try {
        // 🔹 이번 주 월~일 날짜 구간
        const now = new Date();
        const day = now.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const formattedRange = `${format(monday, 'M월 d일', { locale: ko })} ~ ${format(
          sunday,
          'M월 d일',
          { locale: ko }
        )}`;
        setRange(formattedRange);

        // 🔹 Supabase에서 요약 텍스트 불러오기
        const { data, error } = await supabase
          .from('ai_weekly_summaries')
          .select('summary')
          .eq('student_id', viewerId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        setSummary(data?.summary || '요약 데이터가 없습니다.');
      } catch (err) {
        console.error('AIWeeklySummary Error:', err);
        setSummary('요약 데이터를 불러오는 중 오류가 발생했습니다.');
      }
    };

    fetchSummary();
  }, [viewerId, supabase]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold mb-2">AI 학습 요약</h2>
      <p className="text-sm text-gray-500 mb-3">{range}</p>
      <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
        {summary}
      </div>
    </div>
  );
}
