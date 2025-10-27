// lib/dbPlans.ts
import { supabase } from '@/lib/supabaseClient';

/**
 * DB 스키마에 맞춘 Plan 타입
 * (이미지 기준: subject, area, topic, start_at, end_at, memo 등)
 */
export type Plan = {
  id: string;
  user_id: string;
  subject: string;          // NOT NULL 권장
  area: string;             // NOT NULL 권장
  topic?: string | null;
  content?: string | null;
  memo?: string | null;
  start_at: string;         // ISO (timestamptz)
  end_at: string;           // ISO (timestamptz)
  created_at?: string | null;
  updated_at?: string | null;
};

type DraftPlan = Omit<Plan, 'id' | 'created_at' | 'updated_at'>;

/** 최근 N일치 읽기 */
export async function fetchPlans(userId: string, days = 60): Promise<Plan[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .gte('start_at', since.toISOString())
    .order('start_at', { ascending: true });

  if (error) {
    console.error('[fetchPlans] supabase error:', error);
    return [];
  }
  return (data ?? []) as Plan[];
}

/** 새 계획 저장 (DB가 id 생성) */
export async function createPlan(draft: DraftPlan): Promise<Plan> {
  // subject/area 필수 방어
  if (!draft.subject?.trim() || !draft.area?.trim()) {
    throw new Error('과목/영역은 필수입니다.');
  }
  const { data, error } = await supabase
    .from('plans')
    .insert({
      user_id: draft.user_id,
      subject: draft.subject.trim(),
      area: draft.area.trim(),
      topic: draft.topic ?? null,
      content: draft.content ?? null,
      memo: draft.memo ?? null,
      start_at: draft.start_at,
      end_at: draft.end_at,
    })
    .select('*')
    .single();

  if (error || !data) {
    console.error('[createPlan] supabase error:', error);
    throw error || new Error('createPlan failed');
  }
  return data as Plan;
}

/** 수정 저장 */
export async function updatePlan(id: string, patch: Partial<Plan>): Promise<Plan> {
  const { data, error } = await supabase
    .from('plans')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    console.error('[updatePlan] supabase error:', error);
    throw error || new Error('updatePlan failed');
  }
  return data as Plan;
}

/** 삭제 */
export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from('plans').delete().eq('id', id);
  if (error) {
    console.error('[deletePlan] supabase error:', error);
    throw error;
  }
}
