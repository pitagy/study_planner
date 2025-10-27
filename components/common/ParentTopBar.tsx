'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ParentTopBar({
  name,
  role,
  email,
}: {
  name?: string;
  role?: string;
  email?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const viewer = searchParams.get('viewer');
  const studentName = searchParams.get('name');
  const [version, setVersion] = useState<'basic' | 'viewer'>('basic');

  useEffect(() => {
    if (viewer) setVersion('viewer');
    else setVersion('basic');
  }, [viewer]);

  const goParent = () => router.push('/parent');

  const goPlanner = () => {
    if (!viewer || !studentName) return;
    const url = `/student?viewer=${viewer}&name=${encodeURIComponent(studentName)}`;
    router.push(url);
  };

  const goDashboard = () => {
    if (!viewer || !studentName) return;
    const url = `/student/dashboard?viewer=${viewer}&name=${encodeURIComponent(studentName)}`;
    router.push(url);
  };

  const logout = () => router.push('/logout');

  useEffect(() => {
    console.log('🟢 ParentTopBar 렌더링됨');
    console.log('현재 pathname:', pathname);
    console.log('viewer:', viewer, 'studentName:', studentName);
    console.log('version:', version);
  }, [pathname, viewer, studentName, version]);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-3">
        {/* 왼쪽 내비게이션 */}
        <nav className="flex items-center space-x-3">
          {/* ✅ 공통: 학부모 페이지 버튼 */}
          <button
            onClick={goParent}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              pathname === '/parent'
                ? 'bg-black text-white'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            학부모 페이지
          </button>

          {/* ✅ viewer 모드일 때만 자녀용 버튼 표시 */}
          {version === 'viewer' && (
            <>
              <button
                onClick={goPlanner}
                className={`rounded-full border px-4 py-1.5 text-sm ${
                  pathname.includes('/student') && !pathname.includes('dashboard')
                    ? 'bg-black text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {studentName ? `${studentName} 플래너` : '학생 플래너'}
              </button>
              <button
                onClick={goDashboard}
                className={`rounded-full border px-4 py-1.5 text-sm ${
                  pathname.includes('/dashboard')
                    ? 'bg-black text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {studentName ? `${studentName} 대시보드` : '학생 대시보드'}
              </button>
            </>
          )}
        </nav>

        {/* 오른쪽 사용자 정보 */}
        <div className="flex items-center space-x-3 text-sm text-gray-700">
          <span>
            {name ?? ''} · {role ?? 'parent'}
          </span>
          <button
            onClick={logout}
            className="rounded-full border px-4 py-1.5 text-sm bg-black text-white hover:bg-gray-800"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
