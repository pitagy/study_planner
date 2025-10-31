'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';

type AIWeeklySummaryProps = {
  viewerId: string;
  selectedDate: string; // 히트맵에서 클릭한 날짜 (YYYY-MM-DD)
};

export default function AIWeeklySummary({ viewerId, selectedDate }: AIWeeklySummaryProps) {
  const supabase = getSupabaseClient();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [planMin, setPlanMin] = useState(0);
  const [actualMin, setActualMin] = useState(0);
  const [weekRange, setWeekRange] = useState('');
  const [displayDate, setDisplayDate] = useState('');

  /** ✅ 선택한 날짜의 주(월~일) 계산 */
  const computeWeekRange = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00`);
    const start = startOfWeek(d, { weekStartsOn: 1 }); // 월요일
    const end = endOfWeek(d, { weekStartsOn: 1 }); // 일요일
    const rangeText = `${format(start, 'M월 d일', { locale: ko })} ~ ${format(end, 'M월 d일', { locale: ko })}`;
    return { start, end, rangeText };
  };

  /** ✅ dashboard_ai 및 study_days 데이터 불러오기 */
  const loadWeeklySummary = async () => {
    if (!viewerId || !selectedDate) return;

    const { start, end, rangeText } = computeWeekRange(selectedDate);
    setWeekRange(rangeText);
    setDisplayDate(format(new Date(selectedDate), 'M월 d일', { locale: ko }));

    try {
      /** 1️⃣ dashboard_ai 테이블에서 summary 조회 */
      const { data: aiRow, error: aiError } = await supabase
        .from('dashboard_ai')
        .select('summary, start_date, end_date')
        .eq('user_id', viewerId)
        .lte('start_date', selectedDate) // start_date ≤ 클릭한 날짜
        .gte('end_date', selectedDate)   // end_date ≥ 클릭한 날짜
        .maybeSingle();

      if (aiError) console.error('[AIWeeklySummary] AI 요약 조회 오류:', aiError);
      setAiSummary(aiRow?.summary ?? null);

      /** 2️⃣ study_days 테이블에서 주간 계획/실제 시간 합산 */
      const { data: studyRows, error: studyError } = await supabase
        .from('study_days')
        .select('plan_seconds, total_seconds, date')
        .eq('user_id', viewerId)
        .gte('date', start.toISOString())
        .lte('date', end.toISOString());

      if (studyError) console.error('[AIWeeklySummary] study_days 조회 오류:', studyError);

      const planSum = (studyRows ?? []).reduce((sum, r) => sum + (r.plan_seconds || 0), 0);
      const actualSum = (studyRows ?? []).reduce((sum, r) => sum + (r.total_seconds || 0), 0);
      setPlanMin(Math.round(planSum / 60));
      setActualMin(Math.round(actualSum / 60));
    } catch (err) {
      console.error('[AIWeeklySummary] Error:', err);
    }
  };

  /** ✅ selectedDate 변경 시 데이터 로드 */
  useEffect(() => {
    loadWeeklySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerId, selectedDate]);

  // ======================
  // 🔹 실천율 계산
  // ======================
  const rate = planMin ? Math.round((actualMin / planMin) * 100) : 0;
  const rateMsg =
    rate === 0
      ? '저조한 편입니다. 좀 더 분발하여 주세요.'
      : rate < 40
      ? '저조한 편입니다. 좀 더 분발하여 주세요.'
      : rate < 80
      ? '양호한 편입니다. 그러나 아직 조금 부족합니다. 힘내세요. 화이팅!!'
      : '와우~~ 열심히 하고 있군요. 조금만 더 힘내서 목표를 달성하도록 해요!!';

  const planH = Math.floor(planMin / 60);
  const planM = planMin % 60;
  const actH = Math.floor(actualMin / 60);
  const actM = actualMin % 60;

  // ======================
  // 🔹 렌더링
  // ======================
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-200">
      <CardContent className="p-5">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">
            🤖 AI 학습 요약
            {displayDate && <span className="text-gray-500 text-sm ml-2">({displayDate} 선택)</span>}
          </h2>
          {weekRange && <span className="text-sm text-gray-500">{weekRange}</span>}
        </div>

        {/* 🔸 AI 요약이 없을 때 */}
        {!aiSummary && (
          <p className="text-gray-700 leading-relaxed">
            학습에 대한 요약이 생성되지 않았습니다. <br />
            선택한 주의 계획 공부 시간은 {planH}시간 {planM}분이며 실제 공부 시간은 {actH}시간 {actM}분입니다. <br />
            이에 따른 실천율은 {rate}%로 {rateMsg}
          </p>
        )}

        {/* 🔸 AI 요약이 있을 때 */}
        {aiSummary && (
          <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
            <p className="mb-3">
              선택한 주의 계획 공부 시간은 {planH}시간 {planM}분이며 실제 공부 시간은 {actH}시간 {actM}분입니다. <br />
              이에 따른 실천율은 {rate}%로 {rateMsg}
            </p>
            <p className="border-t pt-3 font-medium">{aiSummary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
