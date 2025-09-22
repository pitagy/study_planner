// lib/dbSessions.ts
// 브라우저 Supabase 클라이언트
import { getSupabaseBrowser } from '@/lib/supabaseClient';

const KST_OFFSET_MIN = 9 * 60;
function todayKst(): string {
  const now = new Date();
  // UTC 분 + 540분(=9시간)을 더한 뒤 'YYYY-MM-DD' 반환
  const kst = new Date(now.getTime() + KST_OFFSET_MIN * 60 * 1000);
  return kst.toISOString().slice(0, 10); // YYYY-MM-DD
}

function sb() {
  return getSupabaseBrowser();
}

/**
 * study_days에 오늘자 누적값을 "초" 단위로 가산 upsert
 * - inc_total_sec / inc_plan_sec 는 음수 방지 및 정수 반올림
 */
export async function upsertStudyDayToday(params: {
  user_id: string;
  inc_total_sec: number;
  inc_plan_sec?: number;
}) {
  const client = sb();
  const day = todayKst();

  // 현재 값 조회(없으면 0)
  const { data: row, error: selErr } = await client
    .from('study_days')
    .select('total_seconds, plan_seconds')
    .eq('user_id', params.user_id)
    .eq('date', day)
    .maybeSingle();

  if (selErr) throw selErr;

  const prevTotal = Number(row?.total_seconds ?? 0);
  const prevPlan = Number(row?.plan_seconds ?? 0);

  const next = {
    user_id: params.user_id,
    date: day,
    total_seconds: prevTotal + Math.max(0, Math.floor(params.inc_total_sec || 0)),
    plan_seconds: prevPlan + Math.max(0, Math.floor(params.inc_plan_sec || 0)),
  };

  return client.from('study_days').upsert(next, { onConflict: 'user_id,date' });
}

/**
 * 편의 래퍼: 로그인 사용자의 오늘자 누적을 가산
 * - 두 형태 모두 지원
 *   upsertTodayForMe(1800)
 *   upsertTodayForMe({ inc_total_sec: 1800, inc_plan_sec?: 0 })
 */
export async function upsertTodayForMe(
  arg: number | { inc_total_sec: number; inc_plan_sec?: number }
) {
  const client = sb();
  const { data: auth } = await client.auth.getSession();
  const uid = auth.session?.user?.id;
  if (!uid) throw new Error('로그인이 필요합니다.');

  const inc_total_sec = typeof arg === 'number' ? arg : arg.inc_total_sec;
  const inc_plan_sec = typeof arg === 'number' ? 0 : (arg.inc_plan_sec ?? 0);

  return upsertStudyDayToday({ user_id: uid, inc_total_sec, inc_plan_sec });
}
