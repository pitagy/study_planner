'use client';
import { useEffect, useState } from 'react';
import type { Plan } from '@/types';

export default function InlineEventForm({
  value, onChange, onSubmit, onReset
}: { value: Partial<Plan>; onChange:(v:Partial<Plan>)=>void; onSubmit:()=>void; onReset:()=>void; }){
  const [local, setLocal] = useState<Partial<Plan>>(value);

  // keep local state in sync with parent value (fixes: selection on calendar not reflected)
  useEffect(() => {
    setLocal(value || {});
  }, [
    value?.subject, value?.tag, value?.topic, value?.must_do,
    value?.start_at, value?.end_at
  ]);

  const update = (k: keyof Plan, v: any) => {
    const next = { ...local, [k]: v };
    setLocal(next);
    onChange(next);
  };

  // helpers for datetime-local formatting
  const toLocalInput = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      // yyyy-MM-ddThh:mm
      const pad = (n:number)=>String(n).padStart(2,'0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return ''; }
  };

  return (
    <div className="card space-y-2 p-2">
      {/* 1행: 과목 / 영역 / 공부할 내용 */}
      <div className="grid md:grid-cols-3 gap-2">
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">과목<span className="text-red-500 ml-1">*</span></label>
          <input
            className="input input-bordered"
            placeholder="예: 국어"
            value={local.subject || ''}
            required
            onChange={(e)=>update('subject', e.target.value)}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">영역<span className="text-red-500 ml-1">*</span></label>
          <input
            className="input input-bordered"
            placeholder="예: 독서 / 문법 / 확통"
            value={local.tag || ''}
            required
            onChange={(e)=>update('tag', e.target.value)}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">공부할 내용</label>
          <input
            className="input input-bordered"
            placeholder="예: 기출분석"
            value={local.topic || ''}
            onChange={(e)=>update('topic', e.target.value)}
          />
        </div>
      </div>

      {/* 2행: 시작/종료 시간 */}
      <div className="grid md:grid-cols-2 gap-2">
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">시작시간</label>
          <input
            type="datetime-local"
            className="input input-bordered"
            value={toLocalInput(local.start_at as string)}
            onChange={(e)=>update('start_at', new Date(e.target.value).toISOString())}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">종료시간</label>
          <input
            type="datetime-local"
            className="input input-bordered"
            value={toLocalInput(local.end_at as string)}
            onChange={(e)=>update('end_at', new Date(e.target.value).toISOString())}
          />
        </div>
      </div>

      {/* 3행: 메모 */}
      <div className="flex flex-col">
        <label className="text-sm font-medium mb-1">메모</label>
        <textarea
          className="textarea textarea-bordered w-full"
          rows={2}
          placeholder="필요한 메모를 남겨주세요"
          value={local.must_do || ''}
          onChange={(e)=>update('must_do', e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button onClick={onSubmit} className="btn btn-primary">추가/수정</button>
        <button onClick={onReset} className="btn">초기화</button>
      </div>
    </div>
  );
}
