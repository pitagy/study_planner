'use client';
import type { Plan } from '@/types';

export default function PlanPickerModal({
  open, plans, onPick, onClose
}:{ open:boolean; plans:Plan[]; onPick:(p:Plan)=>void; onClose:()=>void; }){
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
      <div className="card w-full max-w-md">
        <div className="font-bold mb-2">오늘의 계획 선택</div>
        <div className="space-y-2 max-h-[50vh] overflow-auto">
          {plans.map(p=>(
            <button key={p.id} className="w-full text-left px-3 py-2 rounded-xl border"
              onClick={()=>onPick(p)}>
              {new Date(p.start_at).toLocaleTimeString()} · {p.subject} {p.topic||''}
            </button>
          ))}
        </div>
        <div className="mt-3"><button className="px-3 py-2 rounded-xl border" onClick={onClose}>닫기</button></div>
      </div>
    </div>
  );
}
