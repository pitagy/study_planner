'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabaseClient';
import { upsertTodayForMe, upsertStudyDayToday } from '@/lib/dbSessions';

export default function DevPage() {
  const sb = getSupabaseBrowser();
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb.auth.getSession();
      setUid(data.session?.user?.id ?? null);
      (window as any).sb = sb; // 콘솔 테스트용
      console.log('[dev] window.sb ready');
    })();
  }, [sb]);

  const writeOneSession = async () => {
    if (!uid) return alert('로그인 필요');

    // 1) 세션 insert(예제: 3분)
    const end = new Date();
    const start = new Date(end.getTime() - 3 * 60 * 1000);

    const { data: ins, error: e1 } = await sb
      .from('sessions')
      .insert({
        user_id: uid,
        plan_id: null, // 특정 plan과 연결하고 싶으면 UUID 넣기
        actual_start: start.toISOString(),
        actual_end: end.toISOString(),
        duration_min: 3,
        last_seen_at: end.toISOString(),
      })
      .select('id')
      .single();
    if (e1) return alert('insert 실패: ' + e1.message);
    console.log('inserted session id =', ins?.id);

    // 2) 오늘자 누적(초 단위) 가산
    // (A) 로그인 사용자를 내부에서 읽도록:
    await upsertTodayForMe(3 * 60);

    // (B) 또는 uid를 직접 넘기는 정식 함수 사용:
    // await upsertStudyDayToday({ user_id: uid, inc_total_sec: 3 * 60 });

    alert('세션쓰기 + 집계완료! 대시보드 새로고침해서 카드/그래프 반영 확인!');
  };

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-xl font-bold">개발용 세션 쓰기 테스트</h1>
      <div>현재 uid: {uid ?? '(로그인 필요)'}</div>

      <button
        className="rounded bg-black px-4 py-2 text-white"
        onClick={writeOneSession}
      >
        세션 한 건 쓰고 study_days 집계
      </button>
    </main>
  );
}
