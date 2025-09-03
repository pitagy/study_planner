'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Profile, Role } from '@/types';

export default function AdminPage(){
  const [pending,setPending]=useState<Profile[]>([]);
  const [allUsers,setAllUsers]=useState<Profile[]>([]);
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [role,setRole]=useState<Role>('student');
  const [q,setQ]=useState('');

  const reload = async ()=>{
    const [p, a] = await Promise.all([
      supabase.from('profiles').select('id,name,email,role,approved').eq('approved', false).order('created_at'),
      supabase.from('profiles').select('id,name,email,role,approved').order('created_at', {ascending:false}),
    ]);
    setPending(p.data||[]); setAllUsers(a.data||[]);
    setSelected(new Set());
  };

  useEffect(()=>{ reload(); },[]);

  const toggle = (id:string)=>{
    const next = new Set(selected);
    if(next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const batchApprove = async ()=>{
    if(selected.size===0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from('profiles').update({ approved: true }).in('id', ids);
    if(error) alert(error.message); else await reload();
  };

  const batchSetRole = async ()=>{
    if(selected.size===0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from('profiles').update({ role }).in('id', ids);
    if(error) alert(error.message); else await reload();
  };

  const searched = useMemo(()=>{
    const s = (list:Profile[]) => list.filter(u=>u.name.toLowerCase().includes(q.toLowerCase()) || (u.email||'').toLowerCase().includes(q.toLowerCase()));
    return { pending: s(pending), all: s(allUsers) };
  },[pending,allUsers,q]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">관리자 페이지</h1>

      <div className="card space-y-3">
        <div className="flex gap-2 items-center">
          <input className="input" placeholder="이름/이메일 검색" value={q} onChange={e=>setQ(e.target.value)} />
          <select className="input" value={role} onChange={e=>setRole(e.target.value as Role)}>
            <option value="student">student</option>
            <option value="teacher">teacher</option>
            <option value="admin">admin</option>
          </select>
          <button className="btn" onClick={batchApprove}>선택 승인</button>
          <button className="btn" onClick={batchSetRole}>선택 역할 변경</button>
        </div>

        <h2 className="font-bold">승인 대기</h2>
        <div className="grid md:grid-cols-2 gap-2">
          {searched.pending.map(u=>(
            <label key={u.id} className="card flex items-center gap-3">
              <input type="checkbox" checked={selected.has(u.id)} onChange={()=>toggle(u.id)} />
              <div>
                <div className="font-bold">{u.name}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
                <div className="text-xs">role: {u.role}</div>
              </div>
            </label>
          ))}
        </div>

        <h2 className="font-bold pt-2">전체 사용자</h2>
        <div className="grid md:grid-cols-3 gap-2">
          {searched.all.map(u=>(
            <label key={u.id} className="card flex items-center gap-3">
              <input type="checkbox" checked={selected.has(u.id)} onChange={()=>toggle(u.id)} />
              <div>
                <div className="font-bold">{u.name}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
                <div className="text-xs">role: {u.role} / 승인: {u.approved ? 'Y':'N'}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
