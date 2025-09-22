// components/common/StudentPicker.tsx
'use client';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Student = { id: string; name: string | null; email: string | null };

export default function StudentPicker({
  onPick,
  initial,
}: { onPick: (studentId: string) => void; initial?: string }) {
  const supabase = getSupabaseClient();
  const [q, setQ] = useState('');
  const [list, setList] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('role', 'student')
        .order('name', { ascending: true });
      setLoading(false);
      if (!error && data) {
        setList(data as any);
      }
    })();
  }, [supabase]);

  const filtered = list.filter(
    (s) =>
      !q ||
      s.name?.toLowerCase().includes(q.toLowerCase()) ||
      s.email?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="flex items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="학생 검색(이름/이메일)"
        className="border rounded-md px-2 py-1 text-sm"
      />
      <select
        className="border rounded-md px-2 py-1 text-sm"
        defaultValue={initial ?? ''}
        onChange={(e) => {
          const id = e.target.value;
          if (id) onPick(id);
        }}
      >
        <option value="">학생 선택</option>
        {filtered.map((s) => (
          <option key={s.id} value={s.id}>
            {(s.name ?? '(이름없음)')} · {s.email ?? ''}
          </option>
        ))}
      </select>
    </div>
  );
}
