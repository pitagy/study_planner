export type Role = 'student' | 'teacher' | 'admin';

export type Profile = {
  id: string; name: string; phone?: string | null; email?: string | null;
  role: Role; approved: boolean;
};

export type Plan = {
  id: string; user_id: string;
  subject: string; tag?: string | null; must_do?: string | null; topic?: string | null;
  start_at: string; end_at: string;
  focus_target?: number | null; satisfaction_target?: number | null;
  created_at?: string; updated_at?: string;
};

export type Session = {
  id: string; plan_id: string | null; user_id: string;
  actual_start: string; actual_end?: string | null;
  created_at?: string;
};

export type Evaluation = {
  id: string; plan_id: string | null; user_id: string;
  target_achieved?: number | null; rating?: number | null; feedback?: string | null;
  created_at?: string;
};
