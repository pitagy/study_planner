'use client';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * 학생 상단바 (플래너 / 대시보드)
 * - teacher/admin이 viewer 모드로 볼 때에도
 *   쿼리(viewer, name)를 유지한 채 같은 탭 이동
 */
export default function StudentNav() {
  const router = useRouter();
  const sp = useSearchParams();
  const viewer = sp.get('viewer');
  const name = sp.get('name');
  const q = viewer ? `?viewer=${viewer}${name ? `&name=${encodeURIComponent(name)}` : ''}` : '';

  const plannerHref = `/student${q}`;
  const dashboardHref = `/student/dashboard${q}`;
  const btn = 'inline-block rounded-full px-4 py-2 text-sm font-medium bg-black text-white hover:opacity-90';

  const go = (href: string) => router.push(href);

  return (
    <div className="w-full flex items-center gap-3 py-3">
      <button onClick={() => go(plannerHref)} className={btn}>
        플래너
      </button>
      <button onClick={() => go(dashboardHref)} className={btn}>
        대시보드
      </button>
    </div>
  );
}
