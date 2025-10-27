'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getSupabaseClient } from '@/lib/supabaseClient';
import dayjs from 'dayjs';

export default function AIWeeklySummary({ viewerId }: { viewerId: string }) {
  const [summary, setSummary] = useState('');
  const [range, setRange] = useState('');
  const supabase = getSupabaseClient();

  const formatMinutesToHourMin = (min: number) => {
    if (!min) return '0분';
    if (min < 60) return `${Math.round(min)}분`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
  };

  useEffect(() => {
    async function loadSummary() {
      if (!viewerId) return;

      const startOfWeek = dayjs().startOf('week').toISOString();
      const endOfWeek = dayjs().endOf('week').toISOString();

      const { data: plans, error: planErr } = await supabase
        .from('plans')
        .select('start_at, end_at')
        .eq('user_id', viewerId)
        .gte('start_at', startOfWeek)
        .lte('end_at', endOfWeek);

      const { data: sessions, error: sesErr } = await supabase
        .from('sessions')
        .select('duration_min')
        .eq('user_id', viewerId)
        .gte('actual_start', startOfWeek)
        .lte('actual_end', endOfWeek);

      if (planErr) console.error(planErr);
      if (sesErr) console.error(sesErr);

      const planMinutes =
        plans?.reduce((sum, p) => {
          const start = dayjs(p.start_at);
          const end = dayjs(p.end_at);
          return sum + end.diff(start, 'minute');
        }, 0) ?? 0;

      const actualMinutes =
        sessions?.reduce((sum, s) => sum + (s.duration_min ?? 0), 0) ?? 0;

      const rate = planMinutes > 0 ? Math.round((actualMinutes / planMinutes) * 100) : 0;
      const evalText =
        rate <= 40
          ? '저조한 편입니다. 좀 더 분발해 주세요.'
          : rate <= 79
          ? '양호한 편입니다. 조금만 더 힘내세요!'
          : '좋아요! 꾸준히 유지해 봅시다.';

      setSummary(`
현재까지 계획 공부 시간은 <span style="color:#e53935; font-weight:600;">${formatMinutesToHourMin(planMinutes)}</span>, 
실제 공부 시간은 <span style="color:#388e3c; font-weight:600;">${formatMinutesToHourMin(actualMinutes)}</span>입니다.<br>
실천율은 ${rate}%로 ${evalText}<br><br>
AI 학습 요약은 매주 일요일 자동 생성됩니다.`);
      setRange(`${dayjs(startOfWeek).format('M월 D일')} ~ ${dayjs(endOfWeek).format('M월 D일')}`);
    }

    loadSummary();
  }, [viewerId]);

  return (
    <Card className="border rounded-lg shadow-sm bg-white">
      <CardContent className="p-5 leading-relaxed text-gray-700">
        {/* ✅ 타이틀 추가 */}
        <h2 className="text-lg font-semibold text-indigo-700 mb-2">
          🤖 AI 학습 요약
        </h2>

        {/* ✅ 기간 */}
        <div className="text-sm text-gray-500 mb-3">
          {range || '최근 1주 학습 요약'}
        </div>

        {/* ✅ 요약 텍스트 (HTML 적용) */}
        <div
          className="whitespace-pre-wrap text-[15px]"
          dangerouslySetInnerHTML={{
            __html: summary || 'AI 학습 요약을 불러오는 중...',
          }}
        />
      </CardContent>
    </Card>
  );
}
