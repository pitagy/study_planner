"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * 학생 상단바 (플래너 / 대시보드)
 * - teacher/admin이 학생 화면을 새창으로 띄운 경우에도
 *   viewer / name 쿼리를 항상 보존해서 이동합니다.
 */
export default function StudentNav() {
  const sp = useSearchParams();
  const viewer = sp.get("viewer");
  const name = sp.get("name");

  // viewer 모드면 쿼리 보존
  const q =
    viewer ? `?viewer=${viewer}${name ? `&name=${encodeURIComponent(name)}` : ""}` : "";

  const plannerHref = `/student${q}`;
  const dashboardHref = `/student/dashboard${q}`;

  const btn =
    "inline-block rounded-full px-4 py-2 text-sm font-medium bg-black text-white hover:opacity-90";

  return (
    <div className="w-full flex items-center gap-3 py-3">
      <Link href={plannerHref} className={btn}>
        플래너
      </Link>
      <Link href={dashboardHref} className={btn}>
        대시보드
      </Link>
    </div>
  );
}
