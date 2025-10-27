'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

const KEYS = {
  TOTAL_RUNNING: 'study_total_running',
  TOTAL_START: 'study_total_start',
  TOTAL_ACCUM: 'study_total_accum',
  PLAN_RUNNING: 'study_plan_running',
  PLAN_START: 'study_plan_start',
  PLAN_ACCUM: 'study_plan_accum',
  CURRENT_PLAN: 'timer_current_plan',
  STATE: 'study_state',
};

export default function FocusPage() {
  const router = useRouter();
  const sb = getSupabaseClient();
  const [totalSec, setTotalSec] = useState(0);
  const [planSec, setPlanSec] = useState(0);
  const [planLabel, setPlanLabel] = useState('계획이 선택되지 않았습니다');
  const [state, setState] = useState<'ready' | 'running' | 'paused'>('ready');
  const bcRef = useRef<BroadcastChannel | null>(null);

  const fmt = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(r)}`;
  };

  const loadCurrentPlan = () => {
    try {
      const plan = JSON.parse(localStorage.getItem(KEYS.CURRENT_PLAN) ?? '{}');
      if (plan?.label) {
        setPlanLabel(plan.label);
      } else if (plan?.subject) {
        const subject = plan.subject || '';
        const area = plan.area ? ` / ${plan.area}` : '';
        const content = plan.content ? ` / ${plan.content}` : '';
        const start = plan.start_at
          ? new Date(plan.start_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          : '';
        const end = plan.end_at
          ? new Date(plan.end_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          : '';
        const time = start && end ? ` (${start}~${end})` : '';
        setPlanLabel(`${subject}${area}${content}${time}`);
      } else {
        setPlanLabel('계획이 선택되지 않았습니다');
      }
    } catch {
      setPlanLabel('계획이 선택되지 않았습니다');
    }
  };

  const saveStudySession = async () => {
    const plan = JSON.parse(localStorage.getItem(KEYS.CURRENT_PLAN) ?? '{}');
    if (!plan?.id) return;

    const start = localStorage.getItem(KEYS.PLAN_START);
    const accum = parseFloat(localStorage.getItem(KEYS.PLAN_ACCUM) ?? '0');
    let totalSec = accum;
    if (localStorage.getItem(KEYS.PLAN_RUNNING) === '1' && start) {
      const delta = (Date.now() - new Date(start).getTime()) / 1000;
      totalSec += delta;
    }

    const durationMin = Math.max(1, Math.round(totalSec / 60));
    const { data: { user } } = await sb.auth.getUser();
    const uid = user?.id;
    if (!uid) return;

    const now = new Date();
    await sb.from('sessions').insert({
      plan_id: plan.id,
      user_id: uid,
      actual_start: start ? new Date(start).toISOString() : now.toISOString(),
      actual_end: now.toISOString(),
      duration_min: durationMin,
      subject: plan.subject || null,
      area: plan.area || null,
      content: plan.content || null,
      created_at: now.toISOString(),
    });

    alert(`${plan.label || plan.subject || '계획'} 공부시간 ${durationMin}분이 저장되었습니다.`);
  };

  // ✅ 실시간 타이머 루프
  useEffect(() => {
    const t = setInterval(() => {
      const totalRunning = localStorage.getItem(KEYS.TOTAL_RUNNING);
      const totalAccum = parseFloat(localStorage.getItem(KEYS.TOTAL_ACCUM) ?? '0');
      if (totalRunning === '1') {
        const s = localStorage.getItem(KEYS.TOTAL_START);
        if (s) setTotalSec(totalAccum + (Date.now() - new Date(s).getTime()) / 1000);
      } else setTotalSec(totalAccum);

      const planRunning = localStorage.getItem(KEYS.PLAN_RUNNING);
      const planAccum = parseFloat(localStorage.getItem(KEYS.PLAN_ACCUM) ?? '0');
      if (planRunning === '1') {
        const s = localStorage.getItem(KEYS.PLAN_START);
        if (s) setPlanSec(planAccum + (Date.now() - new Date(s).getTime()) / 1000);
      } else setPlanSec(planAccum);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ✅ 초기 상태 복원
  useEffect(() => {
    loadCurrentPlan();

    const planRunning = localStorage.getItem(KEYS.PLAN_RUNNING);
    const totalRunning = localStorage.getItem(KEYS.TOTAL_RUNNING);
    const planAccum = parseFloat(localStorage.getItem(KEYS.PLAN_ACCUM) ?? '0');

    if (planRunning === '1' || totalRunning === '1') {
      setState('running');
    } else if (planAccum > 0) {
      setState('paused');
    } else {
      setState('ready');
    }
  }, []);

  // ✅ pause (일시정지)
  const pausePlan = () => {
    const now = Date.now();

    // 계획 타이머 누적
    const pStart = localStorage.getItem(KEYS.PLAN_START);
    const pAccum = parseFloat(localStorage.getItem(KEYS.PLAN_ACCUM) ?? '0');
    if (pStart) {
      const delta = (now - new Date(pStart).getTime()) / 1000;
      localStorage.setItem(KEYS.PLAN_ACCUM, (pAccum + delta).toString());
    }
    localStorage.setItem(KEYS.PLAN_RUNNING, '0');

    // 전체 타이머 누적 ✅ 수정
    const tStart = localStorage.getItem(KEYS.TOTAL_START);
    const tAccum = parseFloat(localStorage.getItem(KEYS.TOTAL_ACCUM) ?? '0');
    if (tStart) {
      const delta = (now - new Date(tStart).getTime()) / 1000;
      localStorage.setItem(KEYS.TOTAL_ACCUM, (tAccum + delta).toString());
    }
    localStorage.setItem(KEYS.TOTAL_RUNNING, '0');
    localStorage.setItem(KEYS.TOTAL_START, '');
    localStorage.setItem(KEYS.STATE, 'paused');
    setState('paused');
  };

  // ✅ resume (다시시작)
  const resumePlan = () => {
    const now = new Date().toISOString();
    localStorage.setItem(KEYS.PLAN_RUNNING, '1');
    localStorage.setItem(KEYS.PLAN_START, now);
    localStorage.setItem(KEYS.TOTAL_RUNNING, '1');
    localStorage.setItem(KEYS.TOTAL_START, now);
    localStorage.setItem(KEYS.STATE, 'running');
    setState('running');
  };

  // ✅ start (계획공부시작)
  const startAll = () => {
    const now = new Date().toISOString();
    localStorage.setItem(KEYS.TOTAL_RUNNING, '1');
    localStorage.setItem(KEYS.TOTAL_START, now);
    localStorage.setItem(KEYS.PLAN_RUNNING, '1');
    localStorage.setItem(KEYS.PLAN_START, now);
    localStorage.setItem(KEYS.PLAN_ACCUM, '0');
    localStorage.setItem(KEYS.STATE, 'running');
    setState('running');
  };

  // ✅ finish (계획공부종료)
  const finishPlan = async () => {
    await saveStudySession();

    const now = Date.now();
    const tStart = localStorage.getItem(KEYS.TOTAL_START);
    const tAccum = parseFloat(localStorage.getItem(KEYS.TOTAL_ACCUM) ?? '0');
    if (tStart) {
      const delta = (now - new Date(tStart).getTime()) / 1000;
      localStorage.setItem(KEYS.TOTAL_ACCUM, (tAccum + delta).toString());
    }

    localStorage.setItem(KEYS.PLAN_RUNNING, '0');
    localStorage.setItem(KEYS.PLAN_ACCUM, '0');
    localStorage.setItem(KEYS.PLAN_START, '');
    localStorage.setItem(KEYS.TOTAL_RUNNING, '0');
    localStorage.setItem(KEYS.TOTAL_START, '');
    localStorage.setItem(KEYS.STATE, 'ready');
    setPlanSec(0);
    setState('ready');
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-[#dddddd] brightness-75 z-[9999]">
      {/* 닫기 버튼 */}
      <div className="absolute top-6 right-6">
        <button
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            router.push('/student');
          }}
          className="border border-yellow-500 text-yellow-400 px-4 py-2 rounded hover:bg-yellow-500 hover:text-black transition"
        >
          집중모드 닫기 ✕
        </button>
      </div>

      {/* 계획 정보 */}
      <div className="border border-yellow-500 rounded-xl p-6 text-center mb-8 w-[800px]">
        <div className="text-lg font-semibold mb-2 text-yellow-400">계획 정보</div>
        <div className="text-2xl font-bold text-gray-300">{planLabel}</div>
      </div>

      {/* 타이머 */}
      <div className="grid grid-cols-2 gap-8">
        <div className="border border-yellow-500 rounded-xl p-8 w-[350px] text-center">
          <div className="text-lg mb-2 text-yellow-400">오늘 전체 공부시간</div>
          <div className="text-5xl font-mono text-gray-400">{fmt(totalSec)}</div>
        </div>

        <div className="border border-yellow-500 rounded-xl p-8 w-[350px] text-center">
          <div className="text-lg mb-2 text-yellow-400">현재 계획 공부시간</div>
          <div className="text-5xl font-mono mb-4 text-gray-400">{fmt(planSec)}</div>

          {state === 'ready' && (
            <button onClick={startAll} className="w-full py-3 text-lg bg-yellow-500 text-black font-bold rounded">
              계획 공부 시작
            </button>
          )}

          {state === 'running' && (
            <div className="flex flex-row gap-4">
              <button onClick={pausePlan} className="flex-1 py-3 bg-yellow-500 text-black font-bold rounded">
                일시정지
              </button>
              <button onClick={finishPlan} className="flex-1 py-3 bg-red-600 text-white font-bold rounded">
                계획공부종료
              </button>
            </div>
          )}

          {state === 'paused' && (
            <div className="flex flex-row gap-4">
              <button onClick={resumePlan} className="flex-1 py-3 bg-green-500 text-black font-bold rounded">
                다시시작
              </button>
              <button onClick={finishPlan} className="flex-1 py-3 bg-red-600 text-white font-bold rounded">
                계획공부종료
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
