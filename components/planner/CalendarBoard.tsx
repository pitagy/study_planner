'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import type { DateSelectArg, EventClickArg, CalendarApi } from '@fullcalendar/core';

import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);
dayjs.locale('ko');

import { getSupabaseClient } from '@/lib/supabaseClient';

// ===== Types =====
export type Plan = {
  id: string;
  user_id: string;
  subject: string | null;
  area: string | null;
  content: string | null;
  memo: string | null;
  start_at: string; // ISO
  end_at: string;   // ISO
};

type Props = {
  plans?: Plan[];
  readOnly?: boolean;
  onSelectSlot?: (p: { start: string; end: string }) => void;
  showHeaderInput?: boolean;
};

// ===== Color mapping =====
const SUBJECT_COLORS: Record<string, string> = {
  국어: '#2563eb',
  수학: '#16a34a',
  영어: '#d97706',
  탐구: '#a855f7',
};
const colorOf = (s?: string | null) => (s ? SUBJECT_COLORS[s] ?? '#64748b' : '#64748b');

const LS_CURRENT_PLAN = 'timer_current_plan';

// ===== Helper: overlap =====
const isOverlap = (aS: string, aE: string, bS: string, bE: string) =>
  Math.max(dayjs(aS).valueOf(), dayjs(bS).valueOf()) < Math.min(dayjs(aE).valueOf(), dayjs(bE).valueOf());

// ===== DB helpers =====
async function updatePlanById(id: string, patch: Partial<Plan>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('plans')
    .update(patch)
    .eq('id', id)
    .select('id,user_id,subject,area,content,memo,start_at,end_at')
    .maybeSingle();
  if (error) throw error;
  return data as Plan;
}

async function deletePlanById(id: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('plans').delete().eq('id', id);
  if (error) throw error;
}

/** DB 중복 검사 */
async function hasOverlapInDB(userId: string, startISO: string, endISO: string, excludeId?: string) {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('plans')
    .select('id,start_at,end_at')
    .eq('user_id', userId)
    .lt('start_at', endISO)
    .gt('end_at', startISO);
  if (excludeId) q = q.neq('id', excludeId);
  const { data, error } = await q;
  if (error) return false;
  return (data ?? []).length > 0;
}

export default function CalendarBoard({
  plans,
  readOnly = false,
  onSelectSlot,
  showHeaderInput = false,
}: Props) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const calendarRef = useRef<FullCalendar | null>(null);
  const programmaticSelectRef = useRef(false);

  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMeId(data.session?.user.id ?? null));
  }, [supabase]);

  // (옵션) 내부 입력창 상태
  const [subject, setSubject] = useState('');
  const [area, setArea] = useState('');
  const [content, setContent] = useState('');
  const [memo, setMemo] = useState('');
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');

  const [events, setEvents] = useState<any[]>([]);
  const [selected, setSelected] = useState<{ start: string; end: string } | null>(null);

  // ---------- FullCalendar API helpers ----------
  const getApi = (): CalendarApi | undefined => calendarRef.current?.getApi();
  const applySelection = (startISO: string, endISO: string) => {
    const api = getApi();
    if (!api) return;
    programmaticSelectRef.current = true;
    api.select(new Date(startISO), new Date(endISO));
  };

  /** 외부 plans → FullCalendar events */
  useEffect(() => {
    if (!plans) return;
    setEvents(
      plans.map((p) => ({
        id: p.id,
        title: `${p.subject ?? ''} · ${p.area ?? ''} · ${p.content ?? ''}`.replace(/\s·\s$/, ''),
        start: p.start_at,
        end: p.end_at,
        color: colorOf(p.subject),
        backgroundColor: colorOf(p.subject),
        borderColor: colorOf(p.subject),
        textColor: '#fff',
        extendedProps: p,
      }))
    );
  }, [plans]);

  /** selected 상태가 바뀌면 실제 캘린더에 반영 */
  useEffect(() => {
    const api = getApi();
    if (!api) return;
    if (!selected) {
      api.unselect();
      return;
    }
    applySelection(selected.start, selected.end);
  }, [selected]);

  /** 드래그 선택 */
  const handleSelect = (sel: DateSelectArg) => {
    if (programmaticSelectRef.current) {
      programmaticSelectRef.current = false;
      return;
    }
    const startISO = dayjs(sel.start).toISOString();
    const endISO = dayjs(sel.end).toISOString();

    setSelected({ start: startISO, end: endISO });
    setStartText(dayjs(sel.start).format('YYYY-MM-DD HH:mm'));
    setEndText(dayjs(sel.end).format('YYYY-MM-DD HH:mm'));

    onSelectSlot?.({ start: startISO, end: endISO });

    const label = `${subject || '과목'}/${area || '영역'}/${content || '내용'} ${dayjs(sel.start).format('HH:mm')}~${dayjs(sel.end).format('HH:mm')}`;
    localStorage.setItem(LS_CURRENT_PLAN, JSON.stringify({ id: 'draft', label, start: startISO, end: endISO }));
    window.dispatchEvent(new CustomEvent('timer-current-plan', { detail: { id: 'draft', label, start: startISO, end: endISO } }));

    // 여기서는 api.select를 호출하지 않습니다. (selected effect가 처리)
  };

  /** 이벤트 클릭 → 타이머와 동기화 */
  const handleEventClick = (arg: EventClickArg) => {
    const p = arg.event.extendedProps as Plan;
    const label = `${p.subject ?? ''}/${p.area ?? ''}/${p.content ?? ''} ${dayjs(p.start_at).format('HH:mm')}~${dayjs(p.end_at).format('HH:mm')}`;
    localStorage.setItem(LS_CURRENT_PLAN, JSON.stringify({ id: p.id, label, start: p.start_at, end: p.end_at }));
    window.dispatchEvent(new CustomEvent('timer-current-plan', { detail: { id: p.id, label, start: p.start_at, end: p.end_at } }));
  };

  // ===== 오늘 계획 목록 =====
  const todayEvents = useMemo(() => {
    const s = dayjs().startOf('day').toISOString();
    const e = dayjs().endOf('day').toISOString();
    return events
      .filter((ev) => isOverlap(ev.start, ev.end, s, e))
      .sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf());
  }, [events]);

  // ===== 계획 수정/삭제 =====
  const canEdit = (p: Plan) => !readOnly && meId && p.user_id === meId;

  const handleEdit = async (p: Plan) => {
    if (!canEdit(p)) return alert('수정 권한이 없습니다.');

    const newSubject = prompt('과목을 입력하세요', p.subject ?? '') ?? p.subject ?? '';
    const newArea    = prompt('영역을 입력하세요', p.area ?? '') ?? p.area ?? '';
    const newContent = prompt('내용을 입력하세요', p.content ?? '') ?? p.content ?? '';
    const startStr   = prompt('시작 (YYYY-MM-DD HH:mm)', dayjs(p.start_at).format('YYYY-MM-DD HH:mm'));
    const endStr     = prompt('종료 (YYYY-MM-DD HH:mm)', dayjs(p.end_at).format('YYYY-MM-DD HH:mm'));

    const s = startStr ? dayjs(startStr, 'YYYY-MM-DD HH:mm', true) : dayjs(p.start_at);
    const e = endStr   ? dayjs(endStr,   'YYYY-MM-DD HH:mm', true) : dayjs(p.end_at);

    if (!s.isValid() || !e.isValid()) {
      return alert('시간 형식이 올바르지 않습니다. 예) 2025-09-11 06:00');
    }

    const startISO = s.toISOString();
    const endISO   = e.toISOString();

    const overlapLocal = (plans ?? []).some((x) => x.id !== p.id && isOverlap(x.start_at, x.end_at, startISO, endISO));
    if (overlapLocal) return alert('다른 계획과 시간이 겹칩니다.');

    if (await hasOverlapInDB(p.user_id, startISO, endISO, p.id)) {
      return alert('다른 계획과 시간이 겹칩니다.');
    }

    try {
      await updatePlanById(p.id, {
        subject: newSubject,
        area: newArea,
        content: newContent,
        start_at: startISO,
        end_at: endISO,
      });

      localStorage.setItem('plans-updated-ping', Date.now().toString());
      window.dispatchEvent(new Event('plans-updated'));
    } catch (err: any) {
      alert(err?.message ?? '수정 실패');
    }
  };

  const handleDelete = async (p: Plan) => {
    if (!canEdit(p)) return alert('삭제 권한이 없습니다.');
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await deletePlanById(p.id);
      localStorage.setItem('plans-updated-ping', Date.now().toString());
      window.dispatchEvent(new Event('plans-updated'));
    } catch (err: any) {
      alert(err?.message ?? '삭제 실패');
    }
  };

  const headerInput = (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input className="input input-bordered w-48" placeholder="예: 국어" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <input className="input input-bordered w-64" placeholder="예: 독서 / 문학 / 문법 …" value={area} onChange={(e) => setArea(e.target.value)} />
      <input className="input input-bordered w-[320px]" placeholder="예: 현대시 읽기, 기출분석 등" value={content} onChange={(e) => setContent(e.target.value)} />
      <input className="input input-bordered w-60" placeholder="메모" value={memo} onChange={(e) => setMemo(e.target.value)} />
      <input className="input input-bordered w-60 ml-auto" placeholder="시작 (YYYY-MM-DD HH:mm)" value={startText} onChange={(e) => setStartText(e.target.value)} />
      <input className="input input-bordered w-60" placeholder="종료 (YYYY-MM-DD HH:mm)" value={endText} onChange={(e) => setEndText(e.target.value)} />
    </div>
  );

  return (
    <div className="w-full">
      {showHeaderInput && headerInput}

      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        selectable={!readOnly}
        selectMirror
        unselectAuto={false}
        select={handleSelect}
        eventClick={handleEventClick}
        locale={koLocale}
        slotMinTime="06:00:00"
        slotMaxTime="24:00:00"
        height="auto"
        events={events}
        eventDisplay="block"
        eventDidMount={(info) => {
          const p = info.event.extendedProps as Plan;
          const c = colorOf(p?.subject);
          info.el.style.backgroundColor = c;
          info.el.style.borderColor = 'transparent';
          info.el.style.color = 'white';
          info.el.style.opacity = '0.95';
        }}
        headerToolbar={{ left: 'today', center: '', right: 'prev,next' }}
        nowIndicator
        expandRows
        weekNumbers={false}
        dayHeaderFormat={{ weekday: 'short', month: 'numeric', day: 'numeric' }}
        titleFormat={{ year: 'numeric', month: 'long', day: 'numeric' }}
      />

      {/* 오늘 계획한 공부 */}
      <section className="mt-4 rounded-xl border p-4">
        <h3 className="font-semibold mb-3">오늘 계획한 공부</h3>
        {todayEvents.length === 0 ? (
          <div className="text-sm text-gray-500">오늘 계획이 없습니다.</div>
        ) : (
          <ul className="space-y-2">
            {todayEvents.map((ev) => {
              const p = ev.extendedProps as Plan;
              return (
                <li key={ev.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colorOf(p.subject) }} />
                    <div className="font-medium">{p.subject} · {p.area}</div>
                    <div className="text-xs text-gray-500">
                      {dayjs(ev.start).format('HH:mm')} ~ {dayjs(ev.end).format('HH:mm')}
                    </div>
                    {p.memo && <div className="text-xs text-gray-500 truncate max-w-[28ch] ml-2">{p.memo}</div>}
                  </div>

                  {!readOnly && meId === p.user_id && (
                    <div className="flex gap-2">
                      <button className="text-xs rounded-md border px-2 py-1 hover:bg-gray-50" onClick={() => handleEdit(p)}>수정</button>
                      <button className="text-xs rounded-md border px-2 py-1 text-red-600 hover:bg-red-50" onClick={() => handleDelete(p)}>삭제</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
