'use client';
import type { Plan, Session } from '@/types';
export default function StudyAnalytics({plans,sessions}:{plans:Plan[]; sessions:Session[];}){
  return (
    <div className="card">
      <div className="font-bold mb-2">분석(샘플)</div>
      <div className="text-sm text-gray-600">과목×시간 히트맵, 추천 등은 여기서 확장</div>
    </div>
  );
}
