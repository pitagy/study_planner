'use client';
import { useEffect, useRef, useState } from 'react';

export default function FloatingTimer({
  label, onPickPlan, onStart, onPause, onReset, onEnterFullscreen, running
}: { label?:string; onPickPlan:()=>void; onStart:()=>void; onPause:()=>void; onReset:()=>void; onEnterFullscreen:()=>void; running:boolean; }){
  const ref=useRef<HTMLDivElement>(null);
  const [pos,setPos]=useState({x:20,y:20});
  const [size,setSize]=useState({w:260,h:140});
  const [drag,setDrag]=useState<{dx:number,dy:number}|null>(null);
  useEffect(()=>{
    const m=(e:MouseEvent)=>{ if(!drag||!ref.current) return;
      setPos({ x:e.clientX-drag.dx, y:e.clientY-drag.dy }); };
    const u=()=>setDrag(null);
    window.addEventListener('mousemove',m); window.addEventListener('mouseup',u);
    return ()=>{ window.removeEventListener('mousemove',m); window.removeEventListener('mouseup',u); };
  },[drag]);

  return (
    <div ref={ref} className="fixed z-30 bg-white border rounded-2xl shadow-lg p-3"
      style={{left:pos.x, top:pos.y, width:size.w, height:size.h}}>
      <div className="flex justify-between items-center cursor-move" onMouseDown={e=>setDrag({dx:e.clientX-pos.x,dy:e.clientY-pos.y})}>
        <div className="font-bold">플로팅 타이머</div>
        <button className="text-xs px-2 py-1 border rounded-xl" onClick={()=>setSize(s=>({...s,h:s.h+40}))}>크기+</button>
      </div>
      <div className="text-sm mt-1 truncate">{label||'계획을 선택하세요'}</div>
      <div className="mt-2 flex gap-2">
        <button className="px-2 py-1 rounded bg-black text-white" onClick={onPickPlan}>일과시작</button>
        {!running ? (
          <button className="px-2 py-1 rounded bg-black text-white" onClick={onStart}>시작</button>
        ) : (
          <button className="px-2 py-1 rounded bg-black text-white" onClick={onPause}>일시정지</button>
        )}
        <button className="px-2 py-1 rounded border" onClick={onEnterFullscreen}>전체모드</button>
      </div>
    </div>
  );
}
