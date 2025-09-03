'use client';
import { useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import { Plan, Session, Evaluation } from '@/types';
import InlineEventForm from './InlineEventForm';
import RecordModal from './RecordModal';
import PlanPickerModal from './PlanPickerModal';
import FloatingTimer from './FloatingTimer';
import FocusFullscreen from './FocusFullscreen';
import RecommendNextWeekButton from './RecommendNextWeekButton';

type Props = {
  plans: Plan[];
  onCreate: (draft: Partial<Plan>) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Plan>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSession: (s: Partial<Session>) => Promise<void>;
  onEvaluate: (e: Partial<Evaluation>) => Promise<void>;
};

export default function CalendarBoard(props: Props) {
  const { plans, onCreate, onUpdate, onDelete, onSession, onEvaluate } = props;
  const calRef = useRef<any>(null);

  const [form, setForm] = useState<Partial<Plan>>({
    subject: '국어',
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now()+60*60*1000).toISOString(),
  });
  const [recordOpen,setRecordOpen]=useState(false);
  const [activePlan,setActivePlan]=useState<Plan|null>(null);
  const [pickOpen,setPickOpen]=useState(false);
  const [focusOpen,setFocusOpen]=useState(false);
  const [running,setRunning]=useState(false);
  const [currentSession,setCurrentSession]=useState<Session|null>(null);

  const todayPlans = useMemo(() => {
    const k = new Date().toDateString();
    return plans
      .filter(p=>new Date(p.start_at).toDateString()===k)
      .sort((a,b)=>+new Date(a.start_at)-+new Date(b.start_at));
  }, [plans]);

  const openCreateFromSelect = (start: Date, end: Date) => {
    setForm(f=>({ ...f, start_at: start.toISOString(), end_at: end.toISOString(), id: undefined, topic: '' }));
    document.getElementById('planner-top-form')?.scrollIntoView({behavior:'smooth',block:'start'});
  };

  const startStudy = async () => {
    if(!activePlan) return;
    const s: Partial<Session> = {
      plan_id: activePlan.id, user_id: activePlan.user_id, actual_start: new Date().toISOString()
    };
    await onSession(s);
    setRunning(true);
    setCurrentSession(s as Session);
    setFocusOpen(true);
  };
  const pauseStudy = async () => {
    if(!currentSession) return;
    await onSession({ ...currentSession, actual_end: new Date().toISOString() });
    setRunning(false);
  };
  const resumeStudy = async () => { await startStudy(); };
  const endFocus = async () => { setFocusOpen(false); };

  return (
    <div className="space-y-4">
      <div id="planner-top-form">
        <InlineEventForm
          value={form}
          onChange={setForm}
          onSubmit={() => onCreate(form)}
          onReset={() => setForm({
            subject: form.subject || '국어',
            start_at: new Date().toISOString(),
            end_at: new Date(Date.now()+60*60*1000).toISOString(),
          })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="lg:col-span-1 card space-y-2">
          <button className="btn w-full" onClick={()=>{
            const s=new Date(); const e=new Date(s.getTime()+60*60*1000);
            openCreateFromSelect(s,e);
          }}>지금부터 1시간 일정 추가</button>
          <RecommendNextWeekButton plans={plans} onCreate={onCreate} />
        </aside>

        <section className="lg:col-span-3 card overflow-hidden">
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            locales={[koLocale]}
            locale="ko"
            height={760}
            nowIndicator
            slotMinTime="06:00:00"
            slotMaxTime="24:00:00"
            selectable
            selectMirror
            select={(info)=>openCreateFromSelect(info.start, info.end)}
            headerToolbar={{ left:'prev,next today', center:'title', right:'dayGridMonth,timeGridWeek,timeGridDay' }}
            events={plans.map(p=>({
              id:p.id, title:`${p.subject} · ${p.topic ?? ''}`.trim(),
              start:p.start_at, end:p.end_at,
              extendedProps:p,
            }))}
            eventClick={(arg)=>{
              const ext=arg.event.extendedProps as Plan;
              setActivePlan(ext); setRecordOpen(true);
            }}
          />
        </section>
      </div>

      <RecordModal
        open={recordOpen}
        plan={activePlan||undefined}
        onClose={()=>setRecordOpen(false)}
        onSave={async ({ targetAchieved, rating, feedback })=>{
          if(activePlan && (targetAchieved!=null || rating!=null || feedback)){
            await onEvaluate({
              plan_id: activePlan.id, user_id: activePlan.user_id,
              target_achieved: targetAchieved, rating, feedback
            });
          }
          setRecordOpen(false);
        }}
      />

      <FloatingTimer
        label={activePlan ? `${activePlan.subject} · ${activePlan.topic ?? ''}` : undefined}
        onPickPlan={()=>setPickOpen(true)}
        onStart={startStudy}
        onPause={pauseStudy}
        onReset={()=>{}}
        onEnterFullscreen={()=>setFocusOpen(true)}
        running={running}
      />

      <FocusFullscreen open={focusOpen} onPause={pauseStudy} onResume={resumeStudy} onClose={endFocus} />

      <PlanPickerModal
        open={pickOpen}
        plans={todayPlans}
        onClose={()=>setPickOpen(false)}
        onPick={(p)=>{ setActivePlan(p); setPickOpen(false); }}
      />
    </div>
  );
}
