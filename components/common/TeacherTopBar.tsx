'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

type Props = { email: string };

export default function TeacherTopBar({ email }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [signingOut, setSigningOut] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      await fetch('/api/auth/signout', { method: 'POST' });
    } finally {
      router.replace('/login');
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* 좌측 탭 */}
        <nav className="flex gap-2">
          <Link
            href="/teacher"
            className={`rounded-full px-4 py-1.5 text-sm ${isActive('/teacher') ? 'bg-black text-white' : 'bg-white text-black border'}`}
            aria-current={isActive('/teacher') ? 'page' : undefined}
          >
            선생님 페이지
          </Link>
        </nav>

        {/* 우측 사용자/로그아웃 */}
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
            teacher · {email}
          </span>
          <button
            onClick={onSignOut}
            disabled={signingOut}
            className="rounded-full bg-black px-4 py-1.5 text-sm text-white disabled:opacity-60"
          >
            {signingOut ? '로그아웃…' : '로그아웃'}
          </button>
        </div>
      </div>
    </header>
  );
}
