'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type AIWeeklySummaryProps = {
  viewerId: string;
};

export default function AIWeeklySummary({ viewerId }: AIWeeklySummaryProps) {
  const [summary, setSummary] = useState('');
  const [range, setRange] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hasPrev, setHasPrev] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const supabase = getSupabaseClient();

  // 🔹 현재 요약 데이터 불러오기
  const fetchSummary = async (targetDate?: Date) => {
    if (!viewerId) return;

    try {
      // 기준일(targetDate)이 없으면 최신 데이터
      let query = supabase
        .from('dashboard_ai')
        .select('summary, start_date, end_date')
        .eq('user_id', viewerId)
        .order('start_date', { ascending: false })
        .limit(1);

      if (targetDate) {
        query = supabase
          .from('dashboard_ai')
          .select('summary, start_date, end_date')
          .eq('user_id', viewerId)
          .lte('start_date', targetDate.toISOString())
          .order('start_date', { ascending: false })
          .limit(1);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;

      if (data) {
        setSummary(data.summary || '요약 데이터가 없습니다.');
        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        setStartDate(start);
        setEndDate(end);
        const formattedRange = `${format(start, 'M월 d일', { locale: ko })} ~ ${format(
          end,
          'M월 d일',
          { locale: ko }
        )}`;
        setRange(formattedRange);

        // 🔹 이전/다음 데이터 존재 여부 확인
        const { data: prevData } = await supabase
          .from('dashboard_ai')
          .select('id')
          .eq('user_id', viewerId)
          .lt('start_date', start.toISOString())
          .limit(1);
        setHasPrev(!!prevData && prevData.length > 0);

        const { data: nextData } = await supabase
          .from('dashboard_ai')
          .select('id')
          .eq('user_id', viewerId)
          .gt('start_date', start.toISOString())
          .limit(1);
        setHasNext(!!nextData && nextData.length > 0);
      } else {
        setSummary('요약 데이터가 없습니다.');
        setRange('');
      }
    } catch (err) {
      console.error('AIWeeklySummary Error:', err);
      setSummary('요약 데이터를 불러오는 중 오류가 발생했습니다.');
    }
  };

  // 🔹 이전 요약 보기
  const handlePrev = async () => {
    if (!startDate || !hasPrev) return;
    const prevWeek = new Date(startDate);
    prevWeek.setDate(prevWeek.getDate() - 7);
    await fetchSummary(prevWeek);
  };

  // 🔹 다음 요약 보기
  const handleNext = async () => {
    if (!endDate || !hasNext) return;
    const nextWeek = new Date(endDate);
    nextWeek.setDate(nextWeek.getDate() + 7);
    await fetchSummary(nextWeek);
  };

  useEffect(() => {
    fetchSummary();
  }, [viewerId]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">AI 학습 요약</h2>
        <div className="flex gap-2 text-sm">
          <button
            onClick={handlePrev}
            disabled={!hasPrev}
            className={`px-2 py-1 rounded ${
              hasPrev ? 'text-black hover:underline' : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            이전 요약
          </button>
          <button
            onClick={handleNext}
            disabled={!hasNext}
            className={`px-2 py-1 rounded ${
              hasNext ? 'text-black hover:underline' : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            다음 요약
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-3">{range}</p>
      <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
        {summary}
      </div>
    </div>
  );
}
