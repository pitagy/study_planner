import dayjs from 'dayjs';

/** 과목별 계획 vs 실제 공부시간 비교 */
export function mergeSubjectCompare(plans: any[], sessions: any[]) {
  const pMap: Record<string, number> = {};
  plans.forEach((p) => {
    const s = p.subject || '기타';
    const dur = dayjs(p.end_at).diff(dayjs(p.start_at), 'minute');
    pMap[s] = (pMap[s] || 0) + (dur > 0 ? dur : 0);
  });

  const sMap: Record<string, number> = {};
  sessions.forEach((s) => {
    const subj = s.subject || '기타';
    const dur = s.duration_min ?? dayjs(s.actual_end).diff(dayjs(s.actual_start), 'minute');
    sMap[subj] = (sMap[subj] || 0) + (dur > 0 ? dur : 0);
  });

  const subs = Array.from(new Set([...Object.keys(pMap), ...Object.keys(sMap)]));

  return subs.map((sub) => ({
    subject: sub,
    계획: pMap[sub] || 0,
    실제: sMap[sub] || 0,
  }));
}
