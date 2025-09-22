// components/planner/FocusFullscreen.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

import { getSupabaseBrowser as getSupabaseClient } from '@/lib/supabaseClient';

// LocalStorage keys
const LS_PLAN_RUNNING = 'study_plan_running';
const LS_CURRENT_PLAN = 'timer_current_plan';   // { id, label }
const LS_SEGMENTS     = 'focus_segments';       // [{startISO, endISO?}]
const LS_PAUSED       = 'focus_paused';

type Segment = { startISO: string; endISO?: string };

// small time helpers
const nowISO = () => new Date().toISOString();
const secBetween = (sISO: string, eISO: string) =>
  Math.max(0, Math.floor((new Date(eISO).getTime() - new Date(sISO).getTime()) / 1000));

export default function FocusFullscreen() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [running, setRunning]   = useState(false);
  const [paused, setPaused]     = useState(false);
  const [label, setLabel]       = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);

  // 세그먼트/누적 상태
  const segmentsRef  = useRef<Segment[]>([]);
  const accumRef     = useRef<number>(0);           // 종료된 세그먼트 합(초)
  const openStartRef = useRef<string | null>(null); // 진행중 세그먼트 시작시각
  const tickRef      = useRef<number | null>(null);

  // ─────────── helpers ───────────
  const loadLabel = () => {
    try {
      const raw = localStorage.getItem(LS_CURRENT_PLAN);
      const obj = raw ? JSON.parse(raw) : null;
      setLabel(obj?.label ?? '');
      console.log('[focus] loadLabel', obj);
    } catch (e) {
      console.warn('[focus] loadLabel parse error', e);
      setLabel('');
    }
  };

  const loadSegments = () => {
    try {
      const arr = JSON.parse(localStorage.getItem(LS_SEGMENTS) || '[]');
      segmentsRef.current = Array.isArray(arr) ? arr : [];
    } catch {
      segmentsRef.current = [];
    }
  };

  // segments → accum/openStart 재구성
  const rebuildAccumulators = () => {
    accumRef.current = 0;
    openStartRef.current = null;
    for (const s of segmentsRef.current) {
      if (s.endISO) {
        accumRef.current += secBetween(s.startISO, s.endISO);
      } else {
        openStartRef.current = s.startISO; // 마지막 미닫힘을 오픈세그먼트로 간주
      }
    }
    console.log('[focus] rebuildAccumulators', {
      segments: segmentsRef.current,
      accumSec: accumRef.current,
      openStart: openStartRef.current,
    });
  };

  const saveSegments = () => {
    try {
      localStorage.setItem(LS_SEGMENTS, JSON.stringify(segmentsRef.current));
    } catch (e) {
      console.warn('[focus] saveSegments error', e);
    }
  };

  // 현재 경과초 = 누적 + (열려있으면 지금-시작)
  const updateElapsed = () => {
    const add = openStartRef.current ? secBetween(openStartRef.current, nowISO()) : 0;
    const next = accumRef.current + add;
    setElapsedSec(next);
  };

  // ─────────── mount ───────────
  useEffect(() => {
    // 디버그 편의: 콘솔에서 Supabase/내부 상태 접근
    // @ts-ignore
    (window as any).sb = supabase;
    // @ts-ignore
    (window as any).focusDebug = { segmentsRef, accumRef, openStartRef };

    loadLabel();
    loadSegments();
    rebuildAccumulators();

    setRunning(localStorage.getItem(LS_PLAN_RUNNING) === '1');
    setPaused(localStorage.getItem(LS_PAUSED) === '1');
    updateElapsed();

    console.log('[focus] mount', {
      running: localStorage.getItem(LS_PLAN_RUNNING),
      paused: localStorage.getItem(LS_PAUSED),
    });

    tickRef.current = window.setInterval(() => {
      if (running && !paused) updateElapsed();
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────── actions ───────────
  const handleStart = () => {
    console.group('[focus] START click');
    if (running && !paused) {
      console.log('already running');
      console.groupEnd();
      return;
    }

    localStorage.setItem(LS_PLAN_RUNNING, '1');
    localStorage.setItem(LS_PAUSED, '0');

    loadSegments();
    // 새 오픈 세그먼트
    const start = nowISO();
    segmentsRef.current.push({ startISO: start });
    openStartRef.current = start;
    saveSegments();

    setRunning(true);
    setPaused(false);
    updateElapsed();

    console.log('new open segment', start);
    console.groupEnd();
  };

  const handlePause = () => {
    console.group('[focus] PAUSE click');
    console.log('state before', { running, paused, openStart: openStartRef.current });

    if (!running || paused) {
      console.log('guard: !running || paused');
      console.groupEnd();
      return;
    }

    // 오픈 세그먼트를 닫고 누적에 더함
    if (openStartRef.current) {
      const end = nowISO();
      const start = openStartRef.current;
      const inc = secBetween(start, end);
      accumRef.current += inc;

      loadSegments();
      const last = segmentsRef.current[segmentsRef.current.length - 1];
      if (last && !last.endISO) last.endISO = end;
      saveSegments();

      openStartRef.current = null;

      console.log('close segment', { start, end, inc, accum: accumRef.current });
    }

    localStorage.setItem(LS_PAUSED, '1');
    setPaused(true);
    updateElapsed();
    console.groupEnd();
  };

  const handleResume = () => {
    console.group('[focus] RESUME click');
    console.log('state before', { running, paused });

    if (!running || !paused) {
      console.log('guard: !running || !paused');
      console.groupEnd();
      return;
    }

    localStorage.setItem(LS_PAUSED, '0');

    // 새 오픈 세그먼트 시작(누적은 유지)
    const start = nowISO();
    loadSegments();
    segmentsRef.current.push({ startISO: start });
    saveSegments();

    openStartRef.current = start;
    setPaused(false);
    updateElapsed();

    console.log('new open segment', start);
    console.groupEnd();
  };

  const handleFinishPlan = async () => {
    console.group('[focus] FINISH click');
    console.log('state before', { running, paused, openStart: openStartRef.current });

    if (!running) {
      console.log('guard: !running');
      console.groupEnd();
      return;
    }

    try {
      // 미닫힘 세그먼트가 있으면 닫으면서 누적에 반영
      if (openStartRef.current) {
        const end = nowISO();
        const start = openStartRef.current;
        const inc = secBetween(start, end);
        accumRef.current += inc;

        loadSegments();
        const last = segmentsRef.current[segmentsRef.current.length - 1];
        if (last && !last.endISO) last.endISO = end;
        saveSegments();

        openStartRef.current = null;
        console.log('close last open segment', { start, end, inc, accum: accumRef.current });
      }

      const totalSec = accumRef.current;
      const totalMin = Math.max(0, Math.round(totalSec / 60));

      // 연결 계획
      let planId: string | null = null;
      try {
        const raw = localStorage.getItem(LS_CURRENT_PLAN);
        planId = raw ? (JSON.parse(raw)?.id ?? null) : null;
      } catch {}
      console.log('planId', planId);

      // 사용자
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id;
      console.log('uid', uid);
      if (!uid) throw new Error('로그인이 필요합니다.');

      // 세그먼트를 Sessions로 저장
      for (const s of segmentsRef.current) {
        if (!s.endISO) continue;
        const m = Math.max(0, Math.round(secBetween(s.startISO, s.endISO) / 60));
        if (!m) continue;
        const { error: e1 } = await supabase.from('sessions').insert({
          user_id: uid,
          plan_id: planId,
          actual_start: s.startISO,
          actual_end: s.endISO,
          duration_min: m,
          last_seen_at: s.endISO,
        });
        console.log('insert sessions', { seg: s, minutes: m, error: e1 });
        if (e1) throw e1;
      }

      // 오늘(KST) 날짜(UTC+9)
      const todayKst = dayjs().utcOffset(9).format('YYYY-MM-DD');

      // 기존값 조회
      const { data: row, error: e2 } = await supabase
        .from('study_days')
        .select('total_seconds, plan_seconds')
        .eq('user_id', uid).eq('date', todayKst)
        .maybeSingle();
      console.log('select study_days today', { todayKst, row, error: e2 });
      if (e2) throw e2;

      const prevT = Number(row?.total_seconds ?? 0);
      const prevP = Number(row?.plan_seconds ?? 0);
      const incPlan = planId ? totalSec : 0;

      const { error: e3 } = await supabase
        .from('study_days')
        .upsert({
          user_id: uid,
          date: todayKst,
          total_seconds: prevT + totalSec,
          plan_seconds : prevP + incPlan,
        }, { onConflict: 'user_id,date' });
      console.log('upsert study_days', { totalSec, incPlan, error: e3 });
      if (e3) throw e3;

      try {
        localStorage.setItem('stats-updated-ping', Date.now().toString());
        localStorage.setItem('plans-updated-ping', Date.now().toString());
      } catch {}

      alert(`실제 공부시간 ${totalMin}분 저장 성공`);
    } catch (err) {
      console.error('[focus] save error:', err);
      alert('저장 실패');
    } finally {
      // 상태 초기화
      localStorage.setItem(LS_PLAN_RUNNING, '0');
      localStorage.setItem(LS_PAUSED, '0');
      try { localStorage.removeItem(LS_SEGMENTS); } catch {}

      segmentsRef.current = [];
      accumRef.current = 0;
      openStartRef.current = null;
      setElapsedSec(0);
      setRunning(false);
      setPaused(false);

      console.groupEnd();
    }
  };

  // ─────────── UI ───────────
  const fmt = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(r)}`;
  };

  return (
    <div className="min-h-[calc(100vh-100px)] bg-black text-yellow-300">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6">
          <div className="text-sm text-yellow-400/80">계획 정보</div>
          <div className="mt-1 text-2xl font-semibold">
            {label || '연결된 계획 없음'}
          </div>
        </div>

        <div className="my-10">
          <div className="text-7xl md:text-8xl font-mono tracking-wider select-none">
            {fmt(elapsedSec)}
          </div>
          <div className="mt-2 text-sm text-yellow-400/70">
            {running ? (paused ? '일시정지' : '진행 중') : '대기'}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-nowrap overflow-x-auto">
          {!running ? (
            <button
              onClick={handleStart}
              className="whitespace-nowrap rounded-md bg-yellow-500 px-3 py-1.5 text-black text-sm hover:opacity-90"
            >
              계획 공부 시작
            </button>
          ) : (
            <>
              {!paused ? (
                <button
                  onClick={handlePause}
                  className="whitespace-nowrap rounded-md border border-yellow-400 px-3 py-1.5 text-sm hover:bg-yellow-500/10"
                >
                  일시정지
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  className="whitespace-nowrap rounded-md border border-yellow-400 px-3 py-1.5 text-sm hover:bg-yellow-500/10"
                >
                  다시시작
                </button>
              )}
              <button
                onClick={handleFinishPlan}
                className="whitespace-nowrap rounded-md bg-yellow-500 px-3 py-1.5 text-black text-sm hover:opacity-90"
              >
                계획 공부 종료
              </button>
            </>
          )}
        </div>

        <div className="mt-6 text-xs text-yellow-400/70 leading-relaxed">
          • 시간은 <b>누적(accum)</b> + <b>진행중(open)</b> 구조라서 일시정지해도 타이머가 0으로 초기화되지 않습니다.
          <br />• 종료 시 각 세그먼트가 <code>sessions</code>로 저장되고, <code>study_days</code>에 오늘자 누적이 가산됩니다.
        </div>
      </div>
    </div>
  );
}
