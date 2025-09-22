'use client';
import type { Plan } from '@/types';

export default function RecommendNextWeekButton({plans,onCreate}:{plans:Plan[]; onCreate:(p:Partial<Plan>)=>Promise<void>;}){
  const onClick=async()=>{
    // 샘플: 오늘과 같은 시간에 다음주 동일 과목 하나 제안
    const base=plans[0];
    if(!base) return alert('추천할 기준 계획이 없습니다.');
    const s=new Date(base.start_at); s.setDate(s.getDate()+7);
    const e=new Date(base.end_at); e.setDate(e.getDate()+7);
    await onCreate({ ...base, id: undefined, start_at: s.toISOString(), end_at: e.toISOString() });
    alert('다음 주 추천 일정 1개가 추가되었습니다.');
  };
  return <button className="btn w-full" onClick={onClick}>다음 주 자동 배치(샘플)</button>;
}
