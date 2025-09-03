'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { downloadCsv } from '@/lib/csv';
import type { Profile, Plan } from '@/types';

type SortKey = 'name' | 'recent';

export default function TeacherPage(){
  const [students,setStudents]=useState<Profile[]>([]);
  const [plans,setPlans]=useState<Record<string,Plan[]>>({});
  const [query,setQuery]=useState('');
  const [sort,setSort]=useState<SortKey>('name');

  useEffect(()=>{ (async()=>{
    const { data } = await supabase.from('profiles')
      .select('id,name,email,role,approved')
      .eq('approved', true)
      .eq('role','student')
      .order('name');
    setStudents(data||[]);
    // prefetch some plans metadata (recent)
    if(data && data.length){
      const uids = data.map(d=>d.id);
      const chunks = [uids.slice(0,50), uids.slice(50,100), uids.slice(100,150)];
      const dict: Record<string,Plan[]> = {};
      for(const group of chunks.filter(g=>g.length)){
        const { data:pl } = await supabase.from('plans').select('id,user_id,start_at,end_at,subject,topic').in('user_id', group);
        pl?.forEach(p=>{ (dict[p.user_id] ||= []).push(p as any); });
      }
      setPlans(dict);
    }
  })(); },[]);

  const filtered = useMemo(()=>{
    let arr = students.filter(s=> s.name.toLowerCase().includes(query.toLowerCase()) || (s.email||'').toLowerCase().includes(query.toLowerCase()));
    if(sort==='name') arr = arr.sort((a,b)=>a.name.localeCompare(b.name));
    if(sort==='recent') arr = arr.sort((a,b)=>{
      const la = (plans[a.id]?.at(-1)?.start_at)||'';
      const lb = (plans[b.id]?.at(-1)?.start_at)||'';
      return lb.localeCompare(la);
    });
    return arr;
  },[students,query,sort,plans]);

  const exportCsv = async (uid:string)=>{
    const { data: pl } = await supabase.from('plans').select('*').eq('user_id', uid).order('start_at');
    const rows = (pl||[]).map(p=>({plan_id:p.id, subject:p.subject, topic:p.topic, start:p.start_at, end:p.end_at, must_do:p.must_do}));
    downloadCsv(`student-${uid}-plans.csv`, rows);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">선생님 페이지</h1>
      <div className="flex gap-2">
        <input className="input" placeholder="학생 검색(이름/이메일)" value={query} onChange={e=>setQuery(e.target.value)} />
        <select className="input" value={sort} onChange={e=>setSort(e.target.value as SortKey)}>
          <option value="name">이름순</option>
          <option value="recent">최근 활동순</option>
        </select>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(s=>(
          <div key={s.id} className="card">
            <div className="font-bold">{s.name}</div>
            <div className="text-sm text-gray-500">{s.email}</div>
            <div className="text-xs mt-1">최근 계획 수: {plans[s.id]?.length||0}</div>
            <div className="mt-3 flex gap-2">
              <button className="btn" onClick={()=>exportCsv(s.id)}>CSV</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
