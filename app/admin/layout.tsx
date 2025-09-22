// app/admin/layout.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Role = 'student' | 'teacher' | 'admin';
type Profile = { role?: Role; approved?: boolean; name?: string; email?: string };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        router.replace('/login?redirect=/admin');
        return;
      }

      setEmail(userRes.user.email ?? null);

      const { data: prof, error } = await supabase
        .from('profiles')
        .select('role, approved')
        .eq('id', uid)
        .maybeSingle<Profile>();

      if (error || !prof || prof.role !== 'admin') {
        // 관리자가 아니면 학생 홈으로 보냄
        router.replace('/student');
        return;
      }

      setRole('admin');
      setReady(true);

      const { data: sub } = supabase.auth.onAuthStateChange(async (ev) => {
        if (ev === 'SIGNED_OUT') {
          setEmail(null);
          setRole(null);
          router.replace('/login');
        } else if (ev === 'SIGNED_IN' || ev === 'TOKEN_REFRESHED') {
          router.refresh();
        }
      });
      unsub = () => sub.subscription.unsubscribe();
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [router, supabase]);

  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <TopBar
        email={email}
        role={(role ?? 'admin') as Role}
        pathname={pathname}
        onSignOut={async () => {
          await supabase.auth.signOut();
          router.replace('/login');
        }}
      />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

function TopBar({
  email,
  role,
  pathname,
  onSignOut,
}: {
  email: string | null;
  role: Role;
  pathname: string | null;
  onSignOut: () => Promise<void>;
}) {
  const isAdmin = pathname?.startsWith('/admin');

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <nav className="flex items-center gap-2">
          {/* 학생용 링크(학습 플래너) 제거 */}
          <Link
            href="/admin"
            className={`rounded-full px-3 py-1 ${
              isAdmin ? 'bg-black text-white' : 'border hover:bg-gray-50'
            }`}
          >
            관리자 페이지
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
            {role} · {email ?? ''}
          </span>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-full bg-black px-3 py-1 text-white"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
