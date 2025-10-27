// components/common/StudentPicker.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Student = {
  id: string;
  student_name: string | null;
  email: string | null;
  center_name: string | null;
};

type Props = {
  value?: string | null;
  onChange?: (id: string | null, student?: Student | null) => void;
  className?: string;
  label?: string;
};

export default function StudentPicker({
  value = null,
  onChange,
  className = '',
  label = '학생',
}: Props) {
  const supabase = getSupabaseClient();

  // 현재 로그인 사용자의 역할/센터
  const [isTeacher, setIsTeacher] = useState(false);
  const [myCenter, setMyCenter] = useState<string | null>(null);

  // UI 상태
  const [myCenterOnly, setMyCenterOnly] = useState(true); // 선생님일 때 기본 on
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<string | null>(value);

  // 최초 한 번: 내 프로필 가져오기
  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      const { data: me } = await supabase
        .from('profiles')
        .select('role, center_name')
        .eq('id', uid)
        .single();

      if (!ignore && me) {
        const teacher = me.role === 'teacher';
        setIsTeacher(teacher);
        setMyCenter(me.center_name ?? null);
        setMyCenterOnly(teacher); // 선생님이면 기본적으로 내 센터만 보기
      }
    })();
    return () => {
      ignore = true;
    };
  }, [supabase]);

  // 검색 파라미터 결정
  const queryKey = useMemo(
    () => JSON.stringify({ search, myCenterOnly, isTeacher, myCenter }),
    [search, myCenterOnly, isTeacher, myCenter]
  );

  // 학생 목록 읽기
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        let q = supabase
          .from('profiles')
          .select('id, student_name, email, center_name')
          .eq('role', 'student')
          .eq('approved', true);

        // 선생님 + "내 센터만" 체크 시 센터 필터
        if (isTeacher && myCenterOnly && myCenter) {
          q = q.eq('center_name', myCenter);
        }

        if (search.trim()) {
          // 이름/이메일 간단 검색
          const s = `%${search.trim()}%`;
          q = q.or(`student_name.ilike.${s},email.ilike.${s}`);
        }

        const { data, error } = await q.order('student_name', {
          ascending: true,
          nullsFirst: true,
        });

        if (error) throw error;
        if (!ignore) setStudents((data ?? []) as Student[]);
      } catch (e) {
        console.error(e);
        if (!ignore) setStudents([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [queryKey, supabase]);

  // 외부에서 value가 바뀌면 동기화
  useEffect(() => {
    setSel(value ?? null);
  }, [value]);

  const handleSelect = (id: string) => {
    setSel(id || null);
    const picked = students.find((s) => s.id === id) ?? null;
    onChange?.(id || null, picked);
  };

  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      {/* 선생님에게만 보이는 옵션 */}
      {isTeacher && (
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={myCenterOnly}
            onChange={(e) => setMyCenterOnly(e.target.checked)}
          />
          <span>내 센터 학생만</span>
          {myCenterOnly && myCenter && (
            <span className="ml-1 text-gray-500">({myCenter})</span>
          )}
        </label>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="이름/이메일 검색"
        className="mb-2 w-full rounded-md border px-3 py-2"
      />

      <select
        className="w-full rounded-md border px-3 py-2"
        value={sel ?? ''}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={loading}
      >
        <option value="">{loading ? '불러오는 중…' : '학생을 선택하세요'}</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.student_name ?? '(이름없음)'} · {s.email ?? '-'}
            {s.center_name ? ` · ${s.center_name}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
