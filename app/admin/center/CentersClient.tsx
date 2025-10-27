'use client';

import { useMemo, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

type Center = { id: string; name: string; is_active: boolean | null };

export default function CentersClient({
  initialCenters,
}: {
  initialCenters: Center[];
}) {
  const supabase = getSupabaseBrowser();

  // 화면에 표시되는 센터 목록
  const [centers, setCenters] = useState<Center[]>(initialCenters);

  // 로컬에서 바뀐 내용만 모아두는 "더티 맵"
  // ex) { 'uuid-1': { name:'수성구센터' }, 'uuid-2': { is_active:false } }
  const [dirty, setDirty] = useState<Record<string, Partial<Center>>>({});
  const [saving, setSaving] = useState(false);

  // 신규 센터 추가용
  const [newName, setNewName] = useState('');

  // 일괄 변경(프로필)용
  const [fromName, setFromName] = useState('');
  const [toName, setToName] = useState('');

  const pendingCount = useMemo(() => Object.keys(dirty).length, [dirty]);

  // ---------- 센터 추가 ----------
  const addCenter = async () => {
    const name = newName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from('centers')
      .insert({ name })
      .select()
      .single();
    if (error) return alert(error.message);
    setCenters((prev) => [...prev, data]);
    setNewName('');
  };

  // ---------- 로컬 편집(저장 버튼을 누르기 전까지 DB는 바꾸지 않음) ----------
  const updateLocalName = (id: string, name: string) => {
    setCenters((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    setDirty((d) => ({ ...d, [id]: { ...d[id], name } }));
  };

  const updateLocalActive = (id: string, active: boolean) => {
    setCenters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: active } : c)),
    );
    setDirty((d) => ({ ...d, [id]: { ...d[id], is_active: active } }));
  };

  // ---------- 저장(일괄) ----------
  const saveAll = async () => {
    if (pendingCount === 0 || saving) return;
    setSaving(true);
    try {
      const payload = Object.entries(dirty).map(([id, patch]) => ({
        id,
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.is_active !== undefined ? { is_active: !!patch.is_active } : {}),
      }));

      const { data, error } = await supabase
        .from('centers')
        .upsert(payload, { onConflict: 'id' })
        .select();

      if (error) throw error;

      // 저장 결과로 화면 동기화
      if (data?.length) {
        const map = new Map(data.map((c) => [c.id, c]));
        setCenters((prev) => prev.map((c) => map.get(c.id) ?? c));
      }
      setDirty({});
      alert('변경 사항이 저장되었습니다.');
    } catch (e: any) {
      alert(e.message ?? '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // ---------- 센터 삭제(즉시 반영) ----------
  const removeCenter = async (id: string) => {
    if (!confirm('이 센터를 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('centers').delete().eq('id', id);
    if (error) return alert(error.message);
    setCenters((prev) => prev.filter((c) => c.id !== id));
    setDirty((d) => {
      const nd = { ...d };
      delete nd[id];
      return nd;
    });
  };

  // ---------- 센터명 일괄 변경 (profiles.center_name 전체 수정) ----------
  const bulkRenameProfiles = async () => {
    const src = fromName.trim();
    const dst = toName.trim();
    if (!src || !dst) return alert('기존/새 센터명을 모두 입력해 주세요.');
    if (src === dst) return alert('서로 다른 센터명을 입력해 주세요.');
    if (!confirm(`프로필의 센터명을 "${src}" → "${dst}" 로 일괄 변경할까요?`)) return;

    // 관리자 권한(RLS)이 있으므로 클라이언트에서 직접 업데이트 가능
    const { data, error } = await supabase
      .from('profiles')
      .update({ center_name: dst })
      .eq('center_name', src)
      .select('id'); // 변경 개수 파악

    if (error) return alert(error.message);
    alert(`총 ${data.length}건의 프로필이 "${dst}"로 변경되었습니다.`);

    // 현재 목록에도 같은 이름이 있으면 함께 바꿔서 UI 맞춤
    setCenters((prev) =>
      prev.map((c) => (c.name.trim() === src ? { ...c, name: dst } : c)),
    );
    setFromName('');
    setToName('');
  };

  // 중복 없는 센터명 목록(datalist에 사용)
  const centerNames = useMemo(
    () => Array.from(new Set(centers.map((c) => c.name.trim()))).sort(),
    [centers],
  );

  return (
    <div className="space-y-8">
      {/* 상단: 추가 + 저장 */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <input
            className="rounded border px-3 py-2 w-64"
            placeholder="새 센터명 (예: 지산범물센터)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button onClick={addCenter} className="rounded bg-black px-4 py-2 text-white">
            추가
          </button>
        </div>

        <button
          onClick={saveAll}
          disabled={pendingCount === 0 || saving}
          className={`rounded px-4 py-2 text-white ${
            pendingCount === 0 || saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
          title={pendingCount ? `${pendingCount}건 저장` : '변경된 내용이 없습니다'}
        >
          {saving ? '저장 중…' : `저장${pendingCount ? ` (${pendingCount})` : ''}`}
        </button>
      </div>

      {/* 일괄 변경(프로필) */}
      <div className="rounded border p-4 space-y-3">
        <div className="font-semibold">센터명 일괄 변경 (프로필 전체)</div>
        <div className="flex items-center flex-wrap gap-2">
          <input
            list="centerNames"
            className="rounded border px-3 py-2 w-64"
            placeholder="기존 센터명"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />
          <span>→</span>
          <input
            className="rounded border px-3 py-2 w-64"
            placeholder="새 센터명"
            value={toName}
            onChange={(e) => setToName(e.target.value)}
          />
          <button
            onClick={bulkRenameProfiles}
            className="rounded bg-black px-4 py-2 text-white"
          >
            일괄 변경
          </button>
        </div>
        <datalist id="centerNames">
          {centerNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <p className="text-sm text-gray-600">
          * 학생과 선생님을 포함한 모든 프로필의 <code>center_name</code> 값이 대상입니다.
        </p>
      </div>

      {/* 센터 목록 편집 */}
      <ul className="space-y-3">
        {centers.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded border p-3">
            <input
              value={c.name}
              onChange={(e) => updateLocalName(c.id, e.currentTarget.value)}
              className="rounded border px-2 py-1 w-64"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!c.is_active}
                onChange={(e) => updateLocalActive(c.id, e.target.checked)}
              />
              활성
            </label>
            <button
              onClick={() => removeCenter(c.id)}
              className="rounded border px-3 py-1 text-sm"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
