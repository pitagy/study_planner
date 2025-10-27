'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

// ✅ UTC → KST 변환 함수
const toKST = (utcString: string) => {
  if (!utcString) return '';
  const d = new Date(utcString);
  return d.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  });
};

export default function FloatingTimer() {
  const router = useRouter();
  const params = useSearchParams();
  const viewer = params.get('viewer'); // ✅ 뷰어 모드 확인
  const sb = getSupabaseClient();

  // ✅ 뷰어 모드일 경우 표시하지 않음
  if (viewer) return null;

  const [totalSec, setTotalSec] = useState(0);
  const [planSec, setPlanSec] = useState(0);
  const [planLabel, setPlanLabel] = useState('현재 연결된 계획 없음');
  const bcRef = useRef<BroadcastChannel | null>(null);

  const fmt = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(r)}`;
  };

  // ✅ 현재 시간 기반 계획 불러오기
  const loadCurrentPlan = async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const now = new Date().toISOString();
    const { data: plans } = await sb
      .from('plans')
      .select('*')
      .eq('user_id', user.id)
      .lte('start_at', now)
      .gte('end_at', now)
      .limit(1);

    if (plans && plans.length > 0) {
      const plan = plans[0];
      localStorage.setItem(KEYS.CURRENT_PLAN, JSON.stringify(plan));
      setPlanLabel(
        `${plan.subject || ''} / ${plan.area || ''} / ${plan.content || ''} (${toKST(plan.start_at)}~${toKST(plan.end_at)})`
      );
    } else {
      setPlanLabel('현재 연결된 계획 없음');
    }
  };

  // 타이머 갱신
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

  // BroadcastChannel 초기화
  useEffect(() => {
    bcRef.current = new BroadcastChannel('study_timer');
    loadCurrentPlan();
    return () => bcRef.current?.close();
  }, []);

  const bcSend = (type: string) => {
    try {
      const bc = new BroadcastChannel('study_timer');
      bc.postMessage({ type });
      bc.close();
    } catch {}
  };

  // 버튼 동작
  const handleWorkStart = () => {
    const now = new Date().toISOString();
    localStorage.setItem(KEYS.TOTAL_RUNNING, '1');
    localStorage.setItem(KEYS.TOTAL_START, now);
    localStorage.setItem(KEYS.PLAN_RUNNING, '1');
    localStorage.setItem(KEYS.PLAN_START, now);
    localStorage.setItem(KEYS.STATE, 'running');
    bcSend('start-work');
    router.push('/student/focus');
  };

  const handleFocusEnter = () => {
    bcSend('focus-enter');
    router.push('/student/focus');
  };

  const handleWorkEnd = () => {
    bcSend('work-end');
    localStorage.clear();
    setTotalSec(0);
    setPlanSec(0);
    alert('오늘 일과가 종료되었습니다.');
  };

  return (
    <div className="fixed bottom-6 right-6 bg-white/90 backdrop-blur-md border border-green-300 rounded-xl shadow-lg w-[330px] p-4 text-center text-gray-800 z-50">
      <div className="text-left font-bold text-lg text-green-700 mb-2">🟢 플로팅 타이머</div>
      <div className="text-sm mb-2">
        <div className="font-semibold text-gray-700">&lt;현재 계획&gt;</div>
        <div>{planLabel}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-center">
        <div>
          <div className="text-xs text-gray-500">오늘 전체 공부시간</div>
          <div className="font-mono text-lg">{fmt(totalSec)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">현재 계획 공부시간</div>
          <div className="font-mono text-lg">{fmt(planSec)}</div>
        </div>
      </div>

      {/* 버튼 3개 비율 조정 */}
      <div className="flex justify-between items-center gap-1">
        <button
          onClick={handleWorkStart}
          className="flex-[0.8] bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-2 rounded"
        >
          일과시작
        </button>
        <button
          onClick={handleFocusEnter}
          className="flex-[1.2] bg-black hover:bg-gray-700 text-white font-semibold py-2 rounded"
        >
          집중모드가기
        </button>
        <button
          onClick={handleWorkEnd}
          className="flex-[0.8] bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded"
        >
          일과종료
        </button>
      </div>
    </div>
  );
}
