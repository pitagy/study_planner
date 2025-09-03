'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Plan, Session, Evaluation, Profile } from '@/types';
import CalendarBoard from '@/components/planner/CalendarBoard';
import WeeklyMonthlyStats from '@/components/planner/WeeklyMonthlyStats';
import StudyAnalytics from '@/components/planner/StudyAnalytics';
import ExportCsvButton from '@/components/planner/ExportCsvButton';

export default function StudentApp() {
  const [me,setMe]=useState<Profile|null>(null);
  const [plans,setPlans]=useState<Plan[]>([]);
  const [sessions,setSessions]=useState<Session[]>([]);
  const [evals,setEvals]=useState<Evaluation[]>([]);

  useEffect(()=>{ (async()=>{
    const { data:{session} } = await supabase.auth.getSession();
    if(!session) return;
    const uid=session.user.id;
    const { data: p } = await supabase.from('profiles').select('*').eq('id', uid).single();
    setMe(p);
    const [pl, ss, ev] = await Promise.all([
      supabase.from('plans').select('*').eq('user_id', uid).order('start_at'),
      supabase.from('sessions').select('*').eq('user_id', uid).order('actual_start'),
      supabase.from('evaluations').select('*').eq('user_id', uid).order('created_at', {ascending:false}),
    ]);
    setPlans(pl.data||[]); setSessions(ss.data||[]); setEvals(ev.data||[]);
  })(); },[]);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">학습 플래너</h1>
        <ExportCsvButton plans={plans} sessions={sessions} evals={evals} />
      </div>

      <CalendarBoard
        plans={plans}
        onCreate={async (draft) => {
          const { data, error } = await supabase.from('plans').insert(draft).select('*').single();
          if(!error && data) setPlans(prev=>[...prev, data]);
        }}
        onUpdate={async (id, patch) => {
          const { data, error } = await supabase.from('plans').update(patch).eq('id', id).select('*').single();
          if(!error && data) setPlans(prev=>prev.map(p=>p.id===id?data:p));
        }}
        onDelete={async (id) => {
          const { error } = await supabase.from('plans').delete().eq('id', id);
          if(!error) setPlans(prev=>prev.filter(p=>p.id!==id));
        }}
        onSession={async (s) => {
          const { data, error } = await supabase.from('sessions').insert(s).select('*').single();
          if(!error && data) setSessions(prev=>[...prev,data]);
        }}
        onEvaluate={async (e) => {
          const { data, error } = await supabase.from('evaluations').insert(e).select('*').single();
          if(!error && data) setEvals(prev=>[data,...prev]);
        }}
      />

      <WeeklyMonthlyStats plans={plans} sessions={sessions} />
      <StudyAnalytics plans={plans} sessions={sessions} />
    </div>
  );
}
