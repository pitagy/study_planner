'use client';
import { useState } from 'react';
import type { Plan } from '@/types';

export default function RecordModal({
  open, plan, onClose, onSave
}: { open:boolean; plan?:Plan; onClose:()=>void; onSave:(o:{ actualStart?:string, actualEnd?:string, completed?:boolean, targetAchieved?:number, rating?:number, feedback?:string })=>void; }){
  const [targetAchieved,setTA]=useState<number>(80);
  const [rating,setRating]=useState<number>(4);
  const [feedback,setFeedback]=useState('');
  if(!open || !plan) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
      <div className="card w-full max-w-lg">
        <div className="font-bold mb-2">기록 저장 · {plan.subject} {plan.topic||''}</div>
        <div className="grid gap-2">
          <label className="text-sm">오늘 목표 달성률(%)</label>
          <input type="number" className="input" value={targetAchieved} onChange={e=>setTA(Number(e.target.value))} />
          <label className="text-sm">이번 공부 평가(1~5)</label>
          <input type="number" className="input" value={rating} onChange={e=>setRating(Number(e.target.value))} />
          <label className="text-sm">피드백</label>
          <textarea className="input" value={feedback} onChange={e=>setFeedback(e.target.value)} />
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={()=>onSave({ targetAchieved, rating, feedback })}>저장</button>
          <button className="px-3 py-2 rounded-xl border" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
