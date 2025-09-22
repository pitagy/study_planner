'use client';

import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
dayjs.extend(isSameOrAfter);
import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { confirmAsync } from '@/lib/ui';

// ─────────────────────────────────────────────────────────────
// LocalStorage Keys
// ▶ 전체(일과) 타이머 — 새 구조(누적+열린구간)
const LS_TOTAL_RUNNING      = 'study_total_running';      // '1' | '0'
const LS_TOTAL_OPEN_START   = 'study_total_open_start';   // ISO
const LS_TOTAL_ACCUM_SEC    = 'study_total_accum_sec';    // number (누적초)
// ▶ 하위 호환(구버전 플로팅 타이머가 보던 키)
const LS_TOTAL_START        = 'study_total_start';        // ISO(구버전)

// ▶ 계획(플랜) 타이머(기존 유지)
const LS_PLAN_RUNNING      = 'study_plan_running';      // '1' | '0'
const LS_PLAN_START        = 'study_plan_start';        // ISO(플로팅 연동용)
const LS_PLAN_OPEN_START   = 'study_plan_open_start';   // ISO(열린 구간)
const LS_PLAN_ACCUM_SEC    = 'study_plan_accum_sec';    // number
const LS_PLAN_ACCUM_PLANID = 'study_plan_accum_planid'; // 누적 대상 plan
const LS_CURRENT_PLAN      = 'timer_current_plan';      // { id, label, end_at? }

// 자동화 중복 방지용
const LS_AUTO_DAY_CLOSED_FOR   = 'auto_day_closed_for';    // yyyy-MM-dd
const LS_AUTO_FINISHED_PLANID  = 'auto_finished_planid';   // string

// ─────────────────────────────────────────────────────────────
// 유틸
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
}
const inRange = (nowISO: string, startISO?: string, endISO?: string) =>
  !!(startISO && endISO) &&
  dayjs(nowISO).isSameOrAfter(dayjs(startISO)) &&
  dayjs(nowISO).isBefore(dayjs(endISO));

type SPlan = {
  id: string;
  user_id: string;
  subject: string | null;
  area: string | null;
  content: string | null;
  start_at: string;
  end_at: string;
};

// ─────────────────────────────────────────────────────────────
// 종료시 간단 질의(개발단계: 최소화) — 사용자 입력 분 제거(자동 계산만)
async function promptEndWithPlan(): Promise<{ actualMin: number; selfEval?: string } | null> {
  const ok = await confirmAsync('현재 계획과 연결해서 공부를 종료할까요?');
  if (!ok) return null;
  return { actualMin: 0 };
}

async function promptEndNoPlan(): Promise<{
  subject?: string;
  area?: string;
  content?: string;
  actualMin: number;
  selfEval?: string;
} | null> {
  const subject = prompt('과목(예: 국어)') ?? '';
  const area = prompt('영역(예: 독서)') ?? '';
  const content = prompt('내용(예: 기출분석)') ?? '';
  return { subject, area, content, actualMin: 0 };
}

export default function FocusPage() {
  const sb = useMemo(() => getSupabaseClient(), []);
  const [planLabel, setPlanLabel] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);

  // 표시용 타이머 초
  const [totalSec, setTotalSec] = useState(0);
  const [planSec, setPlanSec]   = useState(0);
  const [planRunning, setPlanRunning] = useState(false);

  const tickRef = useRef<number | null>(null);

  // 디버그
  useEffect(() => {
    (window as any).focusDebug = () => {
      console.log('[debug] state', {
        planId,
        planLabel,
        totalSec,
        planSec,
        planRunning,
        LS: {
          total_running: localStorage.getItem(LS_TOTAL_RUNNING),
          total_open   : localStorage.getItem(LS_TOTAL_OPEN_START),
          total_accum  : localStorage.getItem(LS_TOTAL_ACCUM_SEC),
          total_start_legacy: localStorage.getItem(LS_TOTAL_START),

          plan_running : localStorage.getItem(LS_PLAN_RUNNING),
          plan_start   : localStorage.getItem(LS_PLAN_START),
          plan_open    : localStorage.getItem(LS_PLAN_OPEN_START),
          plan_accum   : localStorage.getItem(LS_PLAN_ACCUM_SEC),
          plan_accum_planid: localStorage.getItem(LS_PLAN_ACCUM_PLANID),

          current_plan : localStorage.getItem(LS_CURRENT_PLAN),
          auto_day_closed_for: localStorage.getItem(LS_AUTO_DAY_CLOSED_FOR),
          auto_finished_planid: localStorage.getItem(LS_AUTO_FINISHED_PLANID),
        },
      });
    };
  }, [planId, planLabel, totalSec, planSec, planRunning]);

  // ───────────────────────────────────────────────────────────
  // 현재 시간에 걸친 계획 라벨 동기화
  const syncCurrentPlan = async () => {
    const { data: auth } = await sb.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) {
      setPlanId(null);
      setPlanLabel('');
      try { localStorage.removeItem(LS_CURRENT_PLAN); } catch {}
      return;
    }

    const now = new Date().toISOString();
    const resp: PostgrestSingleResponse<SPlan[]> = await sb
      .from('plans')
      .select('id,user_id,subject,area,content,start_at,end_at')
      .eq('user_id', uid)
      .lte('start_at', now)
      .gte('end_at', now)
      .order('start_at', { ascending: true });

    const current = (resp.data ?? [])[0];
    if (current) {
      const label =
        `${current.subject ?? ''}/${current.area ?? ''}/${current.content ?? ''} ` +
        `${dayjs(current.start_at).format('HH:mm')}~${dayjs(current.end_at).format('HH:mm')}`;
      setPlanId(current.id);
      setPlanLabel(label);
      try {
        localStorage.setItem(
          LS_CURRENT_PLAN,
          JSON.stringify({ id: current.id, label, end_at: current.end_at })
        );
        try { new BroadcastChannel('study_timer').postMessage({ type: 'plan-label', label }); } catch {}
      } catch {}
    } else {
      setPlanId(null);
      setPlanLabel('');
      try { localStorage.removeItem(LS_CURRENT_PLAN); } catch {}
    }
  };

  // 초기 로컬 캐시
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_CURRENT_PLAN);
      if (raw) {
        const saved = JSON.parse(raw);
        const now = dayjs().toISOString();
        if (inRange(now, saved?.start, saved?.end)) {
          setPlanId(saved.id ?? null);
          setPlanLabel(saved.label ?? '');
        } else {
          localStorage.removeItem(LS_CURRENT_PLAN);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    syncCurrentPlan();
    const id = window.setInterval(syncCurrentPlan, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // ───────────────────────────────────────────────────────────
  // 전체(일과) 타이머 — open/close 헬퍼 + 하위호환 처리
  const totalOpen = () => {
    const running = localStorage.getItem(LS_TOTAL_RUNNING) === '1';
    if (running && localStorage.getItem(LS_TOTAL_OPEN_START)) return;

    const nowIso = new Date().toISOString();
    localStorage.setItem(LS_TOTAL_RUNNING, '1');
    localStorage.setItem(LS_TOTAL_OPEN_START, nowIso);

    // 구버전 플로팅 타이머 호환
    localStorage.setItem(LS_TOTAL_START, nowIso);
  };

  const totalPause = () => {
    const running = localStorage.getItem(LS_TOTAL_RUNNING) === '1';
    const openStart = localStorage.getItem(LS_TOTAL_OPEN_START);
    const accum0 = Number(localStorage.getItem(LS_TOTAL_ACCUM_SEC) ?? '0');
    if (running && openStart) {
      const inc = Math.max(0, Math.floor((Date.now() - new Date(openStart).getTime()) / 1000));
      localStorage.setItem(LS_TOTAL_ACCUM_SEC, String(accum0 + inc));
    }
    localStorage.setItem(LS_TOTAL_RUNNING, '0');
    localStorage.removeItem(LS_TOTAL_OPEN_START);

    // 구버전 플로팅 타이머 호환
    localStorage.removeItem(LS_TOTAL_START);
  };

  const totalResetForNewDay = () => {
    localStorage.setItem(LS_TOTAL_ACCUM_SEC, '0');
    localStorage.setItem(LS_TOTAL_RUNNING, '0');
    localStorage.removeItem(LS_TOTAL_OPEN_START);
    localStorage.removeItem(LS_TOTAL_START);
  };

  // 구버전 키를 새 구조로 마이그레이션(첫 로드 시)
  useEffect(() => {
    const running = localStorage.getItem(LS_TOTAL_RUNNING) === '1';
    const legacyStart = localStorage.getItem(LS_TOTAL_START);
    const open = localStorage.getItem(LS_TOTAL_OPEN_START);
    if (running && legacyStart && !open) {
      // 예전엔 start만 있었음 → 열린구간으로 옮김
      localStorage.setItem(LS_TOTAL_OPEN_START, legacyStart);
    }
  }, []);

  // 1초 tick — 전체/계획 모두 누적+열린구간 방식을 화면에 반영
  useEffect(() => {
    const tick = () => {
      // 전체
      const tRun = localStorage.getItem(LS_TOTAL_RUNNING) === '1';
      const tOpen = localStorage.getItem(LS_TOTAL_OPEN_START);
      const tAccum = Number(localStorage.getItem(LS_TOTAL_ACCUM_SEC) ?? '0');
      const tOpenElapsed = tRun && tOpen ? (Date.now() - new Date(tOpen).getTime()) / 1000 : 0;
      setTotalSec(Math.max(0, tAccum + tOpenElapsed));

      // 계획
      const pRun = localStorage.getItem(LS_PLAN_RUNNING) === '1';
      const pOpen = localStorage.getItem(LS_PLAN_OPEN_START);
      const pAccum = Number(localStorage.getItem(LS_PLAN_ACCUM_SEC) ?? '0');
      setPlanRunning(pRun);
      const pOpenElapsed = pRun && pOpen ? (Date.now() - new Date(pOpen).getTime()) / 1000 : 0;
      setPlanSec(Math.max(0, pAccum + pOpenElapsed));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    tickRef.current = id;
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, []);

  // ───────────────────────────────────────────────────────────
  // DB 저장 공통부
  const saveSession = async (payload: {
    plan_id: string | null;
    subject?: string | null;
    area?: string | null;
    content?: string | null;
    actual_start: string;
    actual_end: string;
    duration_min: number;
    self_eval?: string | null;
  }) => {
    console.group('[focus] saveSession');
    try {
      const { data: auth } = await sb.auth.getSession();
      const uid = auth.session?.user?.id!;
      // 1) 세션 기록
      const { error: e1 } = await sb.from('sessions').insert({ user_id: uid, ...payload });
      if (e1) console.warn('insert sessions error', e1);

      // 2) 당일 집계 RPC
      const { error: e2 } = await sb.rpc('upsert_daily_study_for_user', {
        p_user_id: uid,
        p_day_utc: new Date().toISOString(),
      });
      if (e2) console.warn('rpc upsert error', e2);

      // 3) 대시보드 새로고침 핑
      localStorage.setItem('stats-updated-ping', Date.now().toString());
      localStorage.setItem('plans-updated-ping', Date.now().toString());
      window.dispatchEvent(new Event('stats-updated'));
      window.dispatchEvent(new Event('plans-updated'));
    } finally {
      console.groupEnd();
    }
  };

  // ───────────────────────────────────────────────────────────
  // 버튼 핸들러들 (전체/계획 동기화)
  const onPlanStart = async () => {
    // 전체도 함께 시작
    totalOpen();

    if (!planId) {
      alert('지금 시간에 연결된 계획이 없습니다. 계획을 먼저 추가/연결해주세요.');
      return;
    }

    // 다른 계획의 누적이 남아 있다면 리셋
    const accPlan = localStorage.getItem(LS_PLAN_ACCUM_PLANID);
    if (accPlan && accPlan !== planId) {
      localStorage.setItem(LS_PLAN_ACCUM_SEC, '0');
      localStorage.setItem(LS_PLAN_ACCUM_PLANID, planId);
    }
    if (!accPlan) localStorage.setItem(LS_PLAN_ACCUM_PLANID, planId);

    const running = localStorage.getItem(LS_PLAN_RUNNING) === '1';
    if (running) return;

    const startIso = new Date().toISOString();

    // 계획 열린구간 시작
    localStorage.setItem(LS_PLAN_RUNNING, '1');
    localStorage.setItem(LS_PLAN_OPEN_START, startIso);

    // 플로팅 타이머 연동
    localStorage.setItem(LS_PLAN_START, startIso);
    try {
      const raw = localStorage.getItem(LS_CURRENT_PLAN);
      let end_at: string | undefined;
      if (raw) { try { end_at = JSON.parse(raw)?.end_at; } catch {} }
      localStorage.setItem(LS_CURRENT_PLAN, JSON.stringify({
        id: planId, label: planLabel, end_at: end_at ?? undefined,
      }));
      const bc = new BroadcastChannel('study_timer');
      bc.postMessage({ type: 'plan-start', label: planLabel });
      bc.postMessage({ type: 'plan-label', label: planLabel });
      bc.close();
    } catch {}
  };

  const onPlanPauseOrResume = async () => {
    const running = localStorage.getItem(LS_PLAN_RUNNING) === '1';
    const openStart = localStorage.getItem(LS_PLAN_OPEN_START);
    const accumSec = Number(localStorage.getItem(LS_PLAN_ACCUM_SEC) ?? '0');

    if (running) {
      // ▶ 일시정지: 전체도 일시정지
      totalPause();

      // 계획 열린구간을 누적에 더하고 close
      if (openStart) {
        const inc = Math.max(0, Math.floor((Date.now() - new Date(openStart).getTime()) / 1000));
        localStorage.setItem(LS_PLAN_ACCUM_SEC, String(accumSec + inc));
      }
      localStorage.setItem(LS_PLAN_RUNNING, '0');
      localStorage.removeItem(LS_PLAN_OPEN_START);

      // 플로팅 타이머(계획) stop
      localStorage.removeItem(LS_PLAN_START);
      try { new BroadcastChannel('study_timer').postMessage({ type: 'plan-stop' }); } catch {}
    } else {
      // ▶ 다시시작: 전체도 함께 시작
      totalOpen();

      const startIso = new Date().toISOString();
      localStorage.setItem(LS_PLAN_RUNNING, '1');
      localStorage.setItem(LS_PLAN_OPEN_START, startIso);

      // 플로팅 타이머(계획) resume
      localStorage.setItem(LS_PLAN_START, startIso);
      try {
        const bc = new BroadcastChannel('study_timer');
        bc.postMessage({ type: 'plan-start', label: planLabel });
        bc.postMessage({ type: 'plan-label', label: planLabel });
        bc.close();
      } catch {}
    }
  };

  const onPlanFinish = async () => {
    // ▶ 계획 종료 시 전체도 일시정지
    totalPause();

    // 계획 열린구간 반영
    const openStart = localStorage.getItem(LS_PLAN_OPEN_START);
    const accumSec0 = Number(localStorage.getItem(LS_PLAN_ACCUM_SEC) ?? '0');
    const running = localStorage.getItem(LS_PLAN_RUNNING) === '1';

    let accumSec = accumSec0;
    let startIso = openStart ?? new Date().toISOString();
    const endIso = new Date().toISOString();

    if (running && openStart) {
      const inc = Math.max(0, Math.floor((Date.now() - new Date(openStart).getTime()) / 1000));
      accumSec += inc;
      startIso = openStart;
    }

    // 상태 리셋
    localStorage.setItem(LS_PLAN_RUNNING, '0');
    localStorage.removeItem(LS_PLAN_OPEN_START);
    localStorage.removeItem(LS_PLAN_START);
    try { new BroadcastChannel('study_timer').postMessage({ type: 'plan-stop' }); } catch {}

    const incMinAuto = Math.max(1, Math.ceil(accumSec / 60)); // 최소 1분

    if (planId) {
      const ans = await promptEndWithPlan();
      if (!ans) return;

      await saveSession({
        plan_id: planId,
        subject: null, area: null, content: null,
        actual_start: startIso,
        actual_end: endIso,
        duration_min: ans.actualMin || incMinAuto,
        self_eval: null,
      });
    } else {
      const ans = await promptEndNoPlan();
      if (!ans) return;

      await saveSession({
        plan_id: null,
        subject: ans.subject ?? null,
        area: ans.area ?? null,
        content: ans.content ?? null,
        actual_start: startIso,
        actual_end: endIso,
        duration_min: ans.actualMin || incMinAuto,
        self_eval: null,
      });
    }

    // 누적 초기화
    localStorage.setItem(LS_PLAN_ACCUM_SEC, '0');
    localStorage.removeItem(LS_PLAN_ACCUM_PLANID);
    localStorage.removeItem(LS_AUTO_FINISHED_PLANID);

    // 통계 리프레시
    try { localStorage.setItem('stats-updated-ping', Date.now().toString()); } catch {}
    window.dispatchEvent(new Event('stats-updated'));

    alert(`실제 공부시간 ${incMinAuto}분 저장 성공`);
  };

  // ───────────────────────────────────────────────────────────
  // 🔁 자동화: 23:59 자동 일과 종료 + 계획 자동 종료(종료+1분)
  useEffect(() => {
    const timer = window.setInterval(async () => {
      const now = dayjs();
      const hh = now.hour();
      const mm = now.minute();

      // [A] 23:59 자동 일과 종료(1회)
      try {
        const todayKey = now.format('YYYY-MM-DD');
        const already = localStorage.getItem(LS_AUTO_DAY_CLOSED_FOR) === todayKey;

        if (!already && hh === 23 && mm === 59) {
          // 전체 타이머 누적 후 멈춤
          totalPause();
          totalResetForNewDay();

          // 진행중인 계획 자동 종료
          if (localStorage.getItem(LS_PLAN_RUNNING) === '1') {
            await onPlanFinish();
          }

          localStorage.setItem(LS_AUTO_DAY_CLOSED_FOR, todayKey);
          localStorage.setItem('stats-updated-ping', Date.now().toString());
          window.dispatchEvent(new Event('stats-updated'));
        }
      } catch (e) {
        console.warn('[auto day close] error', e);
      }

      // [B] 계획 자동 종료: end_at + 1분
      try {
        const raw = localStorage.getItem(LS_CURRENT_PLAN);
        const isRunning = localStorage.getItem(LS_PLAN_RUNNING) === '1';
        if (!raw || !isRunning) return;

        const cur = JSON.parse(raw || '{}');
        const endAt: string | undefined = cur?.end_at;
        if (!endAt) return;

        const deadline = dayjs(endAt).add(1, 'minute');
        const finishedFor = localStorage.getItem(LS_AUTO_FINISHED_PLANID);
        if (dayjs().isAfter(deadline) && planId && finishedFor !== planId) {
          await onPlanFinish();
          localStorage.setItem(LS_AUTO_FINISHED_PLANID, planId);
        }
      } catch (e) {
        console.warn('[auto plan finish] error', e);
      }
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [planId]);

  // ───────────────────────────────────────────────────────────
  // UI
  return (
    <main className="fixed inset-0 z-[60] bg-black text-yellow-300">
      <button
        className="absolute right-6 top-6 border border-yellow-300 px-4 py-2 rounded-md"
        onClick={() => history.back()}
      >
        집중모드 닫기
      </button>

      <div className="w-full h-full flex items-center justify-center">
        <div className="max-w-5xl w-full px-6">
          {/* 계획 라벨 */}
          <section className="rounded-xl border border-yellow-300 p-6 mb-6">
            <div className="text-xl mb-2">계획 정보</div>
            <div className="text-2xl">{planLabel || '연결된 계획 없음'}</div>
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            {/* 오늘 전체 */}
            <section className="rounded-xl border border-yellow-300 p-6">
              <div className="text-xl mb-3">오늘 전체 공부시간</div>
              <div className="text-6xl font-mono">{fmt(totalSec)}</div>
            </section>

            {/* 현재 계획 */}
            <section className="rounded-xl border border-yellow-300 p-6">
              <div className="text-xl mb-3">현재 계획 공부시간</div>
              <div className="text-6xl font-mono">{fmt(planSec)}</div>
              <div className="text-sm mt-2 opacity-80">{planRunning ? '진행 중' : '대기'}</div>

              <div className="mt-4 flex gap-2">
                <button onClick={onPlanStart} className="flex-1 border border-yellow-400 px-4 py-2 rounded-md">
                  계획 공부 시작
                </button>
                <button onClick={onPlanPauseOrResume} className="flex-1 border border-yellow-400 px-4 py-2 rounded-md">
                  {planRunning ? '일시정지' : '다시시작'}
                </button>
                <button onClick={onPlanFinish} className="flex-1 border border-yellow-400 px-4 py-2 rounded-md">
                  계획 공부 종료
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
