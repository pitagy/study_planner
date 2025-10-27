'use client';

import { useMemo } from 'react';
import type { Plan, Session } from '@/types';

// 시간 계산 유틸
function minutesBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((+b - +a) / 60000));
}
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export default function StudyAnalytics({
  plans,
  sessions,
}: {
  plans: Plan[];
  sessions: Session[];
}) {
  // ---- 공통 키 & 맵 ----
  const todayKey = new Date().toDateString();
  const planById = useMemo(() => {
    const m = new Map<string, Plan>();
    for (const p of plans) if ((p as any).id) m.set((p as any).id, p);
    return m;
  }, [plans]);

  // ---- 오늘 과목별: 계획/실제/실천율 ----
  const subjectStatsToday = useMemo(() => {
    // 오늘 계획 합계(분)
    const plannedMap = new Map<string, number>();
    const todaysPlans = plans.filter(
      (p) => new Date(p.start_at).toDateString() === todayKey
    );
    for (const p of todaysPlans) {
      const subject = p.subject ?? '미지정';
      const min = minutesBetween(new Date(p.start_at), new Date(p.end_at));
      plannedMap.set(subject, (plannedMap.get(subject) ?? 0) + min);
    }

    // 오늘 실제 합계(분) - sessions의 subject는 plan_id로 매핑
    const actualMap = new Map<string, number>();
    const todaysSessions = sessions.filter(
      (s) =>
        s.actual_start &&
        new Date(s.actual_start).toDateString() === todayKey &&
        s.actual_end
    );
    for (const s of todaysSessions) {
      const p = s.plan_id ? planById.get(s.plan_id as any) : undefined;
      const subject = p?.subject ?? '미지정';
      const min = minutesBetween(
        new Date(s.actual_start!),
        new Date(s.actual_end!)
      );
      actualMap.set(subject, (actualMap.get(subject) ?? 0) + min);
    }

    // 병합해서 배열로
    const subjects = new Set<string>([
      ...Array.from(plannedMap.keys()),
      ...Array.from(actualMap.keys()),
    ]);
    return Array.from(subjects).map((subject) => {
      const planned = plannedMap.get(subject) ?? 0;
      const actual = actualMap.get(subject) ?? 0;
      const rate = planned > 0 ? (actual / planned) * 100 : actual > 0 ? 100 : 0;
      return { subject, planned, actual, rate };
    });
  }, [plans, sessions, planById, todayKey]);

  // ---- 이번 주 히트맵(실제) : 과목 × 시간(0~23) ----
  const heatmap = useMemo(() => {
    // 주간 범위 (오늘 포함 7일)
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);

    // subject 행, 24열 분 단위 합계
    const rowMap = new Map<string, number[]>(); // subject => [24]
    const ensureRow = (subject: string) => {
      if (!rowMap.has(subject)) rowMap.set(subject, Array(24).fill(0));
      return rowMap.get(subject)!;
    };

    // session을 시간 단위로 분배
    const weekSessions = sessions.filter((s) => s.actual_start && s.actual_end);
    for (const s of weekSessions) {
      const st = new Date(s.actual_start!);
      const ed = new Date(s.actual_end!);
      if (ed < start || st > end) continue;

      const plan = s.plan_id ? planById.get(s.plan_id as any) : undefined;
      const subject = plan?.subject ?? '미지정';

      let cur = new Date(Math.max(+st, +start));
      const endTime = new Date(Math.min(+ed, +end));
      while (+cur < +endTime) {
        const hour = cur.getHours();
        // 현재 시간대의 끝 (해당 시의 마지막 초)
        const nextHour = new Date(cur);
        nextHour.setMinutes(59, 59, 999);
        const chunkEnd = new Date(Math.min(+nextHour, +endTime));

        const mins = minutesBetween(cur, chunkEnd);
        ensureRow(subject)[hour] += mins;

        // 다음 칸(다음 시간의 시작)
        const next = new Date(nextHour);
        next.setMilliseconds(0);
        next.setSeconds(0);
        next.setMinutes(0);
        next.setHours(next.getHours() + 1);
        cur = next;
      }
    }

    // 색상 스케일을 위한 max
    let max = 0;
    for (const arr of rowMap.values())
      for (const v of arr) if (v > max) max = v;

    return {
      rows: Array.from(rowMap.entries()), // [ [subject, number[24]] , ... ]
      max,
    };
  }, [sessions, planById]);

  return (
    <div className="space-y-6">
      {/* 오늘 과목별 실천율 */}
      <div className="card">
        <div className="font-bold mb-2">오늘 과목별 실천율</div>
        {subjectStatsToday.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2">과목</th>
                <th className="py-2">계획</th>
                <th className="py-2">실제</th>
                <th className="py-2 w-1/2">실천율</th>
              </tr>
            </thead>
            <tbody>
              {subjectStatsToday.map(({ subject, planned, actual, rate }) => (
                <tr key={subject} className="border-t">
                  <td className="py-2">{subject}</td>
                  <td className="py-2">{Math.round(planned)}분</td>
                  <td className="py-2">{Math.round(actual)}분</td>
                  <td className="py-2">
                    <div className="w-full bg-gray-100 rounded h-3 overflow-hidden">
                      <div
                        className="h-full rounded bg-black"
                        style={{ width: `${Math.max(0, Math.min(100, rate))}%` }}
                        title={`${rate.toFixed(0)}%`}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {rate.toFixed(0)}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-sm text-gray-500">오늘 데이터가 없습니다.</div>
        )}
      </div>

      {/* 이번 주 히트맵 (실제 공부 시간) */}
      <div className="card">
        <div className="font-bold mb-2">이번 주 히트맵 (실제 공부시간)</div>
        {!heatmap.rows.length ? (
          <div className="text-sm text-gray-500">데이터가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="text-left pr-2">과목</th>
                  {Array.from({ length: 24 }).map((_, h) => (
                    <th key={h} className="px-1 text-center text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.rows.map(([subject, arr]) => (
                  <tr key={subject}>
                    <td className="pr-2 font-medium">{subject}</td>
                    {arr.map((mins, i) => {
                      const ratio = heatmap.max > 0 ? Math.max(0, Math.min(1, mins / heatmap.max)) : 0;
                      // 밝기 scale: 0~1 -> 90%~20%
                      const light = Math.round(90 - ratio * 70);
                      const bg = `hsl(210 80% ${light}%)`; // 파란 톤
                      return (
                        <td key={i} className="px-0.5 py-0.5">
                          <div
                            className="w-5 h-5 rounded"
                            style={{ background: bg }}
                            title={`${i}시: ${Math.round(mins)}분`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              <span>적음</span>
              <div className="h-3 w-20 bg-[hsl(210_80%_90%)] rounded" />
              <div className="h-3 w-20 bg-[hsl(210_80%_55%)] rounded" />
              <div className="h-3 w-20 bg-[hsl(210_80%_20%)] rounded" />
              <span>많음</span>
            </div>
          </div>
        )}
      </div>

      {/* 확장 안내 */}
      <div className="card">
        <div className="font-bold mb-2">분석(확장 가능)</div>
        <div className="text-sm text-gray-600">
          주차/월간 통계, 목표 대비 추세, 추천 스케줄 등으로 확장할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
