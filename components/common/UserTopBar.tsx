'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

type Props = {
  role: 'student' | 'viewer';
  email?: string;
  name?: string;
};

export default function UserTopBar({ role, email, name }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const viewer = params.get('viewer');
  const viewerName = params.get('name');
  const [isPending, startTransition] = useTransition();

  const displayName = name || email || '';

  const handleLogout = () => {
    if (isPending) return;
    startTransition(async () => {
      try {
        await fetch('/api/auth/signout', { method: 'POST' });
      } catch (_) {}
      router.replace('/login');
    });
  };

  const viewerSuffix = viewer
    ? `?viewer=${viewer}&name=${encodeURIComponent(viewerName ?? '')}`
    : '';

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <nav className="flex items-center gap-2">
          {viewer ? (
            <>
              <Link
                href={`/student${viewerSuffix}`}
                className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white"
              >
                {viewerName ?? '학생'} 플래너
              </Link>
              <Link
                href={`/student/dashboard${viewerSuffix}`}
                className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {viewerName ?? '학생'} 대시보드
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/student"
                className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white"
              >
                플래너
              </Link>
              <Link
                href="/student/dashboard"
                className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                대시보드
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
            {displayName} · {viewer ? 'viewer' : role}
          </span>

          <button
            onClick={handleLogout}
            disabled={isPending}
            className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {isPending ? '로그아웃…' : '로그아웃'}
          </button>
        </div>
      </div>
    </header>
  );
}
