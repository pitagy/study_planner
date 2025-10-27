"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function UnifiedTopBar({
  role,
  name,
  email,
}: {
  role?: string;
  name?: string;
  email?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ✅ URL 파라미터로 전달된 viewer 모드
  const viewer = searchParams.get("viewer");
  const viewerName = searchParams.get("name");

  const isDashboard = pathname.includes("/dashboard");

  // ✅ 역할별 홈 경로
  const homePath =
    role === "admin"
      ? "/admin"
      : role === "teacher"
      ? "/teacher"
      : role === "parent"
      ? "/parent"
      : "/student";

  // ✅ 뷰어 모드일 때 학생별 플래너/대시보드
  const plannerPath =
    viewer && viewerName
      ? `/student?viewer=${viewer}&name=${viewerName}`
      : "/student";
  const dashboardPath =
    viewer && viewerName
      ? `/student/dashboard?viewer=${viewer}&name=${viewerName}`
      : "/student/dashboard";

  return (
    <header className="border-b bg-white text-sm shadow-sm">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-6 py-3">
        {/* ---------------- LEFT ---------------- */}
        <div className="flex items-center space-x-3">
          {/* ✅ 로그인한 사람의 역할 기준으로 홈 버튼 */}
          <Link href={homePath}>
            <button
              className={`rounded-full px-3 py-1 font-medium ${
                pathname.startsWith(homePath)
                  ? "bg-black text-white"
                  : "border border-gray-300 hover:bg-gray-100"
              }`}
            >
              {role === "admin"
                ? "관리자 홈"
                : role === "teacher"
                ? "선생님 홈"
                : role === "parent"
                ? "학부모 홈"
                : "학생 홈"}
            </button>
          </Link>

          {/* ✅ 뷰어 모드일 때 학생 플래너/대시보드 버튼 표시 */}
          {viewer && viewerName && (
            <>
              <Link href={plannerPath}>
                <button
                  className={`rounded-full px-3 py-1 font-medium ${
                    !isDashboard
                      ? "bg-black text-white"
                      : "border border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {viewerName} 플래너
                </button>
              </Link>
              <Link href={dashboardPath}>
                <button
                  className={`rounded-full px-3 py-1 font-medium ${
                    isDashboard
                      ? "bg-black text-white"
                      : "border border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {viewerName} 대시보드
                </button>
              </Link>
            </>
          )}
        </div>

        {/* ---------------- RIGHT ---------------- */}
        <div className="flex items-center space-x-2 text-gray-700">
          {/* ✅ 로그인한 계정 정보는 항상 표시 */}
          {role && name && (
            <span>
              {role === "admin"
                ? "관리자"
                : role === "teacher"
                ? "선생님"
                : role === "parent"
                ? "학부모"
                : "학생"}{" "}
              · {name}
            </span>
          )}
          <Link href="/logout">
            <button className="rounded-full bg-black px-3 py-1 text-white hover:bg-gray-800">
              로그아웃
            </button>
          </Link>
        </div>
      </div>
    </header>
  );
}
