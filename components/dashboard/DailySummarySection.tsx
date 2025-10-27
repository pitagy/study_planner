'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DailySummarySectionProps {
  supabase: any;
  viewerId: string;
  selectedDate: string; // YYYY-MM-DD
}

interface StudySummary {
  subject: string;
  planned_min: number;
  actual_min: number;
}

export default function DailySummarySection({
  supabase,
  viewerId,
  selectedDate,
}: DailySummarySectionProps) {
  const [summaryData, setSummaryData] = useState<StudySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !viewerId || !selectedDate) return;

    const fetchDailySummary = async () => {
      try {
        setLoading(true);

        // 1) 계획
        const { data: plans, error: planError } = await supabase
          .from('plans')
          .select('subject, duration_min')
          .eq('user_id', viewerId)
          .eq('date', selectedDate);

        if (planError) throw planError;

        // 2) 실제
        const { data: sessions, error: sessionError } = await supabase
          .from('sessions')
          .select('subject, duration_min, actual_start, actual_end')
          .eq('user_id', viewerId)
          .gte('actual_start', `${selectedDate}T00:00:00`)
          .lte('actual_end', `${selectedDate}T23:59:59`);

        if (sessionError) throw sessionError;

        // 3) 과목별 합산
        const map: Record<string, { planned_min: number; actual_min: number }> = {};

        (plans ?? []).forEach((p) => {
          const subj = p.subject || '기타';
          if (!map[subj]) map[subj] = { planned_min: 0, actual_min: 0 };
          map[subj].planned_min += p.duration_min || 0;
        });

        (sessions ?? []).forEach((s) => {
          const subj = s.subject || '기타';
          if (!map[subj]) map[subj] = { planned_min: 0, actual_min: 0 };
          map[subj].actual_min += s.duration_min || 0;
        });

        const chartData: StudySummary[] = Object.entries(map).map(
          ([subject, v]) => ({
            subject,
            planned_min: v.planned_min,
            actual_min: v.actual_min,
          })
        );

        setSummaryData(chartData);
      } catch (e) {
        console.error('🔥 [DailySummarySection] fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchDailySummary();
  }, [supabase, viewerId, selectedDate]);

  // ✅ 계획/실천 요약 계산 + 피드백 문장 생성
  const feedback = useMemo(() => {
    if (summaryData.length === 0) {
      return {
        percent: null as number | null,
        lines: ['학습 데이터가 없습니다.'],
      };
    }

    const totalPlanned = summaryData.reduce((a, c) => a + (c.planned_min || 0), 0);
    const totalActual = summaryData.reduce((a, c) => a + (c.actual_min || 0), 0);
    const percent =
      totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : null;

    // 상/하위 과목 파악
    const byActualDesc = [...summaryData].sort(
      (a, b) => (b.actual_min || 0) - (a.actual_min || 0)
    );
    const topActual = byActualDesc[0];
    const lowActual = byActualDesc[byActualDesc.length - 1];

    // 계획 대비 차이(초과/미달) 절대값 큰 순
    const byDiffDesc = [...summaryData]
      .map((s) => ({
        subject: s.subject,
        diff: (s.actual_min || 0) - (s.planned_min || 0),
        planned: s.planned_min || 0,
        actual: s.actual_min || 0,
      }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    const biggest = byDiffDesc[0]; // 가장 차이가 큰 과목
    const positive = biggest && biggest.diff > 0;
    const negative = biggest && biggest.diff < 0;

    const lines: string[] = [];

    // 1) 총합 요약
    if (percent === null) {
      if (totalActual > 0) {
        lines.push(
          `오늘은 총 ${totalActual}분 공부했어요. 계획은 없었지만 스스로 학습한 점이 멋져요!`
        );
      } else {
        lines.push('학습 기록이 없어요. 가볍게 10분이라도 시작해 보자요 💪');
      }
    } else {
      lines.push(
        `오늘의 실천율은 **${percent}%** 입니다. (계획 ${totalPlanned}분 / 실제 ${totalActual}분)`
      );
      if (percent >= 85) {
        lines.push('아주 훌륭해요! 계획에 맞춰 성실하게 실천했어요 👏');
      } else if (percent >= 60) {
        lines.push('좋아요, 절반 이상 실천했어요. 내일은 조금만 더 끌어올려 볼까요? 🙂');
      } else if (percent > 0) {
        lines.push('시작이 반! 오늘은 낮았지만 내일은 한 과목이라도 확실히 달성해 보죠 💡');
      } else {
        lines.push('아직 실천이 없었어요. 10분 전략으로 가볍게 스타트! 🚀');
      }
    }

    // 2) 과목 인사이트
    if (topActual && topActual.actual_min > 0) {
      lines.push(
        `가장 집중한 과목은 **${topActual.subject}(${topActual.actual_min}분)**이에요.`
      );
    }

    if (biggest && biggest.diff !== 0) {
      if (positive) {
        lines.push(
          `특히 **${biggest.subject}**에서 계획보다 **${biggest.diff}분 더** 공부했어요. 좋은 흐름이에요!`
        );
      } else if (negative) {
        lines.push(
          `**${biggest.subject}**는 계획보다 **${Math.abs(
            biggest.diff
          )}분 적게** 실천했어요. 내일은 이 과목부터 가볍게 15분만 시작해 볼까요?`
        );
      }
    }

    // 3) 제안
    if (percent !== null && percent < 85) {
      lines.push('⏱️ 팁: 타이머 25분 + 휴식 5분(포모도로)로 리듬을 만들어 보세요.');
    }

    return { percent, lines };
  }, [summaryData]);

  const titleLabel = useMemo(() => {
    // YYYY-MM-DD -> "M월 D일" 표시
    try {
      const [y, m, d] = selectedDate.split('-').map((v) => parseInt(v, 10));
      return `${m}월 ${d}일의 학습 요약`;
    } catch {
      return `${selectedDate}의 학습 요약`;
    }
  }, [selectedDate]);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          📊 {titleLabel}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-gray-500">데이터를 불러오는 중...</p>
        ) : summaryData.length === 0 ? (
          <p className="text-gray-500">학습 데이터가 없습니다.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summaryData}>
                <XAxis dataKey="subject" />
                <YAxis />
                <Tooltip formatter={(v) => `${v}분`} />
                <Legend />
                <Bar dataKey="planned_min" fill="#009688" name="계획" />
                <Bar dataKey="actual_min" fill="#ff7043" name="실제" />
              </BarChart>
            </ResponsiveContainer>

            {/* ✅ 범례 아래 피드백 문장 */}
            <div className="mt-4 space-y-1 text-sm leading-6">
              {feedback.lines.map((line, idx) => (
                <p key={idx} className="text-gray-800">
                  {/* 굵게 마크다운 스타(*) 없이 처리 */}
                  {line.replace(/\*\*/g, '')}
                </p>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
