'use client';
import { useState } from 'react';
import type { Plan } from '@/types';

export default function InlineEventForm({
  value, onChange, onSubmit, onReset
}: { value: Partial<Plan>; onChange:(v:Partial<Plan>)=>void; onSubmit:()=>void; onReset:()=>void; }){
  const [local,setLocal]=useState<Partial<Plan>>(value);
  const update=(k:keyof Plan, v:any)=>{ const next={...local,[k]:v}; setLocal(next); onChange(next); };
  return (
    <div className="card grid md:grid-cols-6 gap-2">
      <select className="input" value={local.subject||'국어'} onChange={e=>update('subject',e.target.value)}>
        <option>국어</option><option>수학</option><option>영어</option><option>탐구</option><option>기타</option>
      </select>
      <input className="input" placeholder="태그" value={local.tag||''} onChange={e=>update('tag',e.target.value)} />
      <input className="input" placeholder="주제/단원" value={local.topic||''} onChange={e=>update('topic',e.target.value)} />
      <input className="input" type="datetime-local" value={(local.start_at||'').slice(0,16)} onChange={e=>update('start_at', new Date(e.target.value).toISOString())} />
      <input className="input" type="datetime-local" value={(local.end_at||'').slice(0,16)} onChange={e=>update('end_at', new Date(e.target.value).toISOString())} />
      <input className="input" placeholder="오늘 꼭 해야 하는 공부 내용" value={local.must_do||''} onChange={e=>update('must_do',e.target.value)} />

      <div className="md:col-span-6 flex gap-2">
        <button className="btn" onClick={onSubmit}>추가/수정</button>
        <button className="px-3 py-2 rounded-xl border" onClick={onReset}>초기화</button>
      </div>
    </div>
  );
}
