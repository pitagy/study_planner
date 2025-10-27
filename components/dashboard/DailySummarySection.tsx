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

        // ✅ 날짜 범위 계산 (00:00 ~ 23:59)
        const startOfDay = `${selectedDate}T00:00:00`;
        const endOfDay = `${selectedDate}T23:59:59`;

        // 1️⃣ 계획(plan)
        const { data: plans, error: planError } = await supabase
          .from('plans')
          .select('subject, start_at, end_at')
          .eq('user_id', viewerId)
          .gte('start_at', startOfDay)
          .lte('start_at', endOfDay);

        if (planError) throw planError;

        // 실제 duration 계산
        const planData = (plans ?? []).map((p) => {
          const start = new Date(p.start_at);
          const end = new Date(p.end_at);
          const duration_min = (end.getTime() - start.getTime()) / 60000;
          return { subject: p.subject || '기타', duration_min: Math.max(0, duration_min) };
        });

        // 2️⃣ 실천(session)
        const { data: sessions, error: sessionError } = await supabase
          .from('sessions')
          .select('subject, actual_start, actual_end, duration_min')
          .eq('user_id', viewerId)
          .gte('actual_start', startOfDay)
          .lte('actual_end', endOfDay);

        if (sessionError) throw sessionError;

        const sessionData = (sessions ?? []).map((s) => ({
          subject: s.subject || '기타',
          duration_min:
            s.duration_min ??
            Math.max(
              0,
              (new Date(s.actual_end).getTime() - new Date(s.actual_start).getTime()) / 60000
            ),
        }));

        // 3️⃣ 과목별 합산
        const map: Record<string, { planned_min: number; actual_min: number }> = {};

        planData.forEach((p) => {
          if (!map[p.subject]) map[p.subject] = { planned_min: 0, actual_min: 0 };
          map[p.subject].planned_min += p.duration_min;
        });

        sessionData.forEach((s) => {
          if (!map[s.subject]) map[s.subject] = { planned_min: 0, actual_min: 0 };
          map[s.subject].actual_min += s.duration_min;
        });

        const chartData: StudySummary[] = Object.entries(map).map(([subject, v]) => ({
          subject,
          planned_min: Math.round(v.planned_min),
          actual_min: Math.round(v.actual_min),
        }));

        setSummaryData(chartData);
      } catch (e) {
        console.error('🔥 [DailySummarySection] fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchDailySummary();
  }, [supabase, viewerId, selectedDate]);

  // ✅ 계획 대비 실천율 + 피드백 생성
  const feedback = useMemo(() => {
    if (summaryData.length === 0) {
      return {
        percent: null,
        lines: ['학습 데이터가 없습니다.'],
      };
    }

    const totalPlanned = summaryData.reduce((a, c) => a + (c.planned_min || 0), 0);
    const totalActual = summaryData.reduce((a, c) => a + (c.actual_min || 0), 0);
    const percent =
      totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : null;

    const lines: string[] = [];
    if (percent === null) {
      if (totalActual > 0)
        lines.push(`오늘은 총 ${totalActual}분 공부했어요. 계획은 없었지만 자발적 학습이 멋져요!`);
      else lines.push('학습 기록이 없습니다.');
    } else {
      lines.push(`오늘의 실천율은 ${percent}% 입니다. (계획 ${totalPlanned}분 / 실제 ${totalActual}분)`);
      if (percent >= 85) lines.push('👏 아주 잘했어요! 계획대로 실천했습니다.');
      else if (percent >= 60) lines.push('🙂 나쁘지 않아요. 내일은 조금만 더 올려봐요!');
      else if (percent > 0) lines.push('🔥 시작이 반이에요! 꾸준함으로 채워봐요!');
      else lines.push('💡 오늘은 아직 실천이 없어요. 10분이라도 시작해요!');
    }

    return { percent, lines };
  }, [summaryData]);

  const titleLabel = useMemo(() => {
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

            {/* 피드백 문장 표시 */}
            <div className="mt-4 space-y-1 text-sm leading-6">
              {feedback.lines.map((line, idx) => (
                <p key={idx} className="text-gray-800">
                  {line}
                </p>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
