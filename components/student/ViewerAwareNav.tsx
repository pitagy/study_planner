// components/student/ViewerAwareNav.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";

type Props = { className?: string };

export default function ViewerAwareNav({ className }: Props) {
  const sp = useSearchParams();
  const viewer = sp.get("viewer");
  const name = sp.get("name");

  // viewer 모드라면 쿼리를 보존해서 링크 구성
  const q =
    viewer ? `?viewer=${viewer}${name ? `&name=${encodeURIComponent(name)}` : ""}` : "";

  const plannerHref = `/student${q}`;
  const dashboardHref = `/student/dashboard${q}`;

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <Link
        href={plannerHref}
        className="inline-block rounded-full px-4 py-2 text-sm bg-black text-white hover:opacity-90"
      >
        플래너
      </Link>
      <Link
        href={dashboardHref}
        className="inline-block rounded-full px-4 py-2 text-sm bg-black text-white hover:opacity-90"
      >
        대시보드
      </Link>
    </div>
  );
}
