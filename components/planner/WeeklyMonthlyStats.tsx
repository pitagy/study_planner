'use client';
import type { Plan, Session } from '@/types';

export default function WeeklyMonthlyStats({plans,sessions}:{plans:Plan[]; sessions:Session[];}){
  const totalPlans=plans.length;
  const totalSessions=sessions.length;
  return (
    <div className="card">
      <div className="font-bold mb-2">간단 통계</div>
      <div className="text-sm">계획 수: {totalPlans} · 세션 수: {totalSessions}</div>
    </div>
  );
}
