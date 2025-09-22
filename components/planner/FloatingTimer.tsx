// components/planner/FloatingTimer.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { getSupabaseClient } from '@/lib/supabaseClient';

// ─────────────────────────────────────────────
// 집중모드와 반드시 동일해야 하는 키
// ─────────────────────────────────────────────
const KEYS = {
  TOTAL_RUNNING: 'study_total_running',
  TOTAL_START:   'study_total_start',
  PLAN_RUNNING:  'study_plan_running',
  PLAN_START:    'study_plan_start',
  CURRENT_PLAN:  'timer_current_plan', // { id, label, end_at? }
  PING:          'study_timer_ping',
  POS:           'floating_timer_pos',
};

type CurrentPlanLS = { id: string; label?: string; end_at?: string };

// ─────────────────────────────────────────────
// 작은 유틸
// ─────────────────────────────────────────────
const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(r)}`;
};

const nowISO = () => new Date().toISOString();

export default function FloatingTimer({ show = true }: { show?: boolean }) {
  const router = useRouter();
  const sb = useMemo(() => getSupabaseClient(), []);

  // 표시 상태
  const [totalSec, setTotalSec] = useState(0);
  const [planSec, setPlanSec] = useState(0);
  const [planLabel, setPlanLabel] = useState('');

  // 위치 상태(드래그)
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const rafMove = useRef<number | null>(null);

  // ─ 위치 복원
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEYS.POS);
      if (raw) {
        const { x, y } = JSON.parse(raw);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          setPos({ x, y });
          return;
        }
      }
    } catch {}
    // 기본 우하단
    setPos({
      x: Math.max(8, window.innerWidth - 360 - 24),
      y: Math.max(8, window.innerHeight - 220 - 24),
    });
  }, []);

  const beginDrag = (cx: number, cy: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragging.current = true;
    dragOffset.current = { x: cx - rect.left, y: cy - rect.top };
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    try { localStorage.setItem(KEYS.POS, JSON.stringify(pos)); } catch {}
  };
  const moveDrag = (cx: number, cy: number) => {
    if (!dragging.current) return;
    const w = 360, h = 220;
    const nx = cx - dragOffset.current.x;
    const ny = cy - dragOffset.current.y;
    setPos({
      x: Math.min(Math.max(0, nx), Math.max(0, window.innerWidth - w)),
      y: Math.min(Math.max(0, ny), Math.max(0, window.innerHeight - h)),
    });
  };
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (rafMove.current) cancelAnimationFrame(rafMove.current);
      rafMove.current = requestAnimationFrame(() => moveDrag(e.clientX, e.clientY));
    };
    const onMouseUp = () => endDrag();

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]; if (!t) return;
      if (rafMove.current) cancelAnimationFrame(rafMove.current);
      rafMove.current = requestAnimationFrame(() => moveDrag(t.clientX, t.clientY));
    };
    const onTouchEnd = () => endDrag();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [pos.x, pos.y]);

  const onMouseDown = (e: React.MouseEvent) => { e.preventDefault(); beginDrag(e.clientX, e.clientY); };
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; if (t) beginDrag(t.clientX, t.clientY); };

  // ─ 현재 계획 라벨/정보 복원
  const getCurrentPlanLS = (): CurrentPlanLS | null => {
    try {
      const raw = localStorage.getItem(KEYS.CURRENT_PLAN);
      if (!raw) return null;
      return JSON.parse(raw) as CurrentPlanLS;
    } catch { return null; }
  };
  useEffect(() => {
    const cp = getCurrentPlanLS();
    setPlanLabel(cp?.label ?? '');
  }, []);

  // ─ 카운팅 다시계산
  const recompute = () => {
    try {
      const totalRun = localStorage.getItem(KEYS.TOTAL_RUNNING) === '1';
      const totalStart = localStorage.getItem(KEYS.TOTAL_START);
      setTotalSec(totalRun && totalStart ? (Date.now() - new Date(totalStart).getTime()) / 1000 : 0);

      const planRun = localStorage.getItem(KEYS.PLAN_RUNNING) === '1';
      const planStart = localStorage.getItem(KEYS.PLAN_START);
      setPlanSec(planRun && planStart ? (Date.now() - new Date(planStart).getTime()) / 1000 : 0);
    } catch {
      setTotalSec(0); setPlanSec(0);
    }
  };

  // ─ 1초 갱신 + 자정 자동 종료 검사 + 계획 자동 종료 검사(10초 주기)
  useEffect(() => {
    recompute();
    const secTick = window.setInterval(recompute, 1000);

    const tenSec = window.setInterval(async () => {
      await maybeAutoFinishPlan();
      await maybeAutoEndWorkdayAtMidnight();
    }, 10_000);

    return () => {
      clearInterval(secTick);
      clearInterval(tenSec);
    };
  }, []);

  // ─ storage/Broadcast 연동
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === KEYS.CURRENT_PLAN && e.newValue) {
        try { setPlanLabel(JSON.parse(e.newValue)?.label ?? ''); } catch {}
      }
      if ([KEYS.PLAN_RUNNING, KEYS.PLAN_START, KEYS.TOTAL_RUNNING, KEYS.TOTAL_START].includes(e.key)) {
        recompute();
      }
    };
    window.addEventListener('storage', onStorage);

    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel('study_timer'); } catch {}
    const onMsg = (e: MessageEvent) => {
      const msg = e.data ?? {};
      if (msg?.type === 'plan-label') setPlanLabel(msg.label ?? '');
      if (['plan-start', 'plan-stop', 'total-start', 'total-stop'].includes(msg?.type)) {
        recompute();
      }
    };
    bc?.addEventListener('message', onMsg);

    return () => {
      window.removeEventListener('storage', onStorage);
      bc?.removeEventListener('message', onMsg);
      bc?.close();
    };
  }, []);

  // ─ 버튼 액션
  const startWorkday = () => {
    if (localStorage.getItem(KEYS.TOTAL_RUNNING) !== '1') {
      const iso = nowISO();
      localStorage.setItem(KEYS.TOTAL_RUNNING, '1');
      localStorage.setItem(KEYS.TOTAL_START, iso);
      localStorage.setItem(KEYS.PING, Date.now().toString());
      try { new BroadcastChannel('study_timer').postMessage({ type: 'total-start' }); } catch {}
    }
    router.push('/student/focus');
  };

  const endWorkday = async (opts?: { auto?: boolean }) => {
    // total 저장(총 경과 초를 study_days.total_seconds에 누적)
    await saveTodayTotalSeconds();

    // 로컬 상태 종료
    localStorage.setItem(KEYS.TOTAL_RUNNING, '0');
    localStorage.removeItem(KEYS.TOTAL_START);

    // (안정) 계획도 함께 정지
    localStorage.setItem(KEYS.PLAN_RUNNING, '0');
    localStorage.removeItem(KEYS.PLAN_START);

    try {
      const bc = new BroadcastChannel('study_timer');
      bc.postMessage({ type: 'total-stop' });
      bc.postMessage({ type: 'plan-stop' });
      bc.close();
    } catch {}

    // 대시보드 갱신 핑
    try { localStorage.setItem('stats-updated-ping', Date.now().toString()); } catch {}
    window.dispatchEvent(new Event('stats-updated'));

    if (!opts?.auto) {
      // 사용자가 직접 누른 경우만 현재 페이지 유지
    }
  };

  // ─ 오늘 총 공부시간 저장(study_days.total_seconds에 더하기)
  const saveTodayTotalSeconds = async () => {
    const totalRun = localStorage.getItem(KEYS.TOTAL_RUNNING) === '1';
    const totalStart = localStorage.getItem(KEYS.TOTAL_START);
    if (!totalStart) return;

    const elapsedSec = Math.max(0, Math.floor((Date.now() - new Date(totalStart).getTime()) / 1000));
    if (!elapsedSec) return;

    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) return;

    // 기존에 쓰던 study_days 누적 API (이미 프로젝트에 있음)
    // 없으면 DB RPC upsert / 테이블 upsert 함수로 바꿔 쓰세요.
    await sb.from('study_days').upsert({
      user_id: uid,
      date: dayjs().format('YYYY-MM-DD'),
      total_seconds: elapsedSec, // 누적이 아니라 "세션처럼 가산"하려면 +로 더해주도록 조정
    }, { onConflict: 'user_id,date' });
  };

  // ─ 자정 자동 종료(23:59 지나면 자동 종료 & 저장)
  const maybeAutoEndWorkdayAtMidnight = async () => {
    const run = localStorage.getItem(KEYS.TOTAL_RUNNING) === '1';
    const start = localStorage.getItem(KEYS.TOTAL_START);
    if (!run || !start) return;

    const startDay = dayjs(start).local().format('YYYY-MM-DD');
    const nowDay = dayjs().format('YYYY-MM-DD');
    if (startDay !== nowDay) {
      // 날짜가 넘어갔다면 전날로 저장하고 종료
      await saveTodayTotalSeconds();
      await endWorkday({ auto: true });
    } else {
      // 같은 날이면 23:59:50 이후에 안전 종료
      const nearMidnight = dayjs().hour(23).minute(59).second(50);
      if (dayjs().isAfter(nearMidnight)) {
        await saveTodayTotalSeconds();
        await endWorkday({ auto: true });
      }
    }
  };

  // ─ 계획 자동 종료(계획 종료 + 1분 경과 시 자동 저장)
  const maybeAutoFinishPlan = async () => {
    const isRun = localStorage.getItem(KEYS.PLAN_RUNNING) === '1';
    const startISO = localStorage.getItem(KEYS.PLAN_START);
    if (!isRun || !startISO) return;

    const cp = getCurrentPlanLS();
    if (!cp?.id) return;

    // end_at 정보를 못 받았다면(구버전) 서버에서 조회
    let endAt = cp.end_at ? dayjs(cp.end_at) : null;
    if (!endAt) {
      const { data: pl } = await sb.from('plans').select('end_at').eq('id', cp.id).maybeSingle();
      endAt = pl?.end_at ? dayjs(pl.end_at) : null;
    }
    if (!endAt) return;

    const cutoff = endAt.add(1, 'minute');
    if (dayjs().isAfter(cutoff)) {
      // 자동 종료: sessions 한 건 저장(플랜 연결)
      const { data: sess } = await sb.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) return;

      const startedAt = dayjs(startISO).toDate().toISOString();
      const endedAt = dayjs().toDate().toISOString();

      await sb.from('sessions').insert({
        user_id: uid,
        plan_id: cp.id,
        actual_start: startedAt,
        actual_end: endedAt,
        duration_min: Math.max(1, Math.ceil((dayjs(endedAt).diff(dayjs(startedAt), 'minute', true)))),
        last_seen_at: endedAt,
      });

      // 로컬 상태 종료
      localStorage.setItem(KEYS.PLAN_RUNNING, '0');
      localStorage.removeItem(KEYS.PLAN_START);

      try {
        const bc = new BroadcastChannel('study_timer');
        bc.postMessage({ type: 'plan-stop' });
        bc.close();
      } catch {}

      // 대시보드 갱신 핑
      try { localStorage.setItem('stats-updated-ping', Date.now().toString()); } catch {}
      window.dispatchEvent(new Event('stats-updated'));
    }
  };

  if (!show) return null;

  return (
    <div
      ref={rootRef}
      style={{ position: 'fixed', left: pos.x, top: pos.y, width: 360, zIndex: 40 }}
      className="rounded-2xl border bg-[#F0FFF4] shadow-xl p-3 select-none"
    >
      <div
        className="mb-2 flex cursor-move items-center justify-between"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <div className="font-semibold">플로팅 타이머</div>
        <div className="text-xs text-gray-500">현재 계획: {planLabel ? '연결됨' : '미연결'}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border bg-white p-2">
          <div className="mb-1 text-xs text-gray-500">오늘 전체 공부시간</div>
          <div className="font-mono text-xl">{fmt(totalSec)}</div>
        </div>
        <div className="rounded-xl border bg-white p-2">
          <div className="mb-1 text-xs text-gray-500">현재 계획 공부시간</div>
          <div className="font-mono text-xl">{fmt(planSec)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <button onClick={startWorkday} className="flex-1 rounded-md bg-black py-2 text-white">일과시작</button>
        <button onClick={() => router.push('/student/focus')} className="flex-1 rounded-md border py-2">집중모드가기</button>
        <button onClick={() => endWorkday()} className="rounded-md border px-3 py-2" title="전체/계획 종료">일과종료</button>
      </div>
    </div>
  );
}
