'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';

type Props = { email: string };

export default function AdminTopBar({ email }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const viewer = params.get('viewer');
  const name = params.get('name');
  const [signingOut, setSigningOut] = useState(false);

  const baseViewerParam = viewer ? `?viewer=${viewer}&name=${name ?? ''}` : '';

  const tabs = [
    { href: '/admin', label: '관리자 페이지' },
    { href: '/admin/center', label: '센터관리' },
  ];

  const isActive = (href: string) => pathname.startsWith(href);
  const pill = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm transition ${
      active ? 'bg-black text-white' : 'bg-white text-black border'
    }`;

  const onSignOut = async () => {
    try {
      setSigningOut(true);
      await fetch('/api/auth/signout', { method: 'POST' });
    } finally {
      location.href = '/login';
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* 왼쪽: 탭 */}
        <nav className="flex gap-2">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className={pill(isActive(t.href))}>
              {t.label}
            </Link>
          ))}
        </nav>

        {/* 오른쪽: 정보 */}
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
            admin · {email}
          </span>
          <button
            onClick={onSignOut}
            disabled={signingOut}
            className="rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
