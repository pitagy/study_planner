'use client';
import { Plan, Session, Evaluation } from '@/types';
import { downloadCsv } from '@/lib/csv';

export default function ExportCsvButton({
  plans, sessions, evals
}: { plans:Plan[]; sessions:Session[]; evals:Evaluation[]; }) {
  const download = () => {
    const now = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    const rows = plans.map(p=>({
      plan_id:p.id, subject:p.subject, tag:p.tag, must_do:p.must_do, topic:p.topic,
      start:p.start_at, end:p.end_at, focus_target:p.focus_target, satisfaction_target:p.satisfaction_target
    }));
    downloadCsv(`study-plans-${now}.csv`, rows);
  };
  return <button className="btn" onClick={download}>CSV 다운로드</button>;
}
