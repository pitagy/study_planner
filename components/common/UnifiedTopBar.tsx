'use client';

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function UnifiedTopBar({
  role,
  name,
  email,
  viewerName, // ✅ 추가됨
}: {
  role?: string;
  name?: string;
  email?: string;
  viewerName?: string | null; // ✅ 타입 정의 추가
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ✅ URL 파라미터로 전달된 viewer 모드
  const viewer = searchParams.get("viewer");
  const viewerNameFromUrl = searchParams.get("name");

  // ✅ props가 우선, 없으면 URL 파라미터 사용
  const effectiveViewerName = viewerName ?? viewerNameFromUrl;

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
    viewer && effectiveViewerName
      ? `/student?viewer=${viewer}&name=${encodeURIComponent(effectiveViewerName)}`
      : "/student";
  const dashboardPath =
    viewer && effectiveViewerName
      ? `/student/dashboard?viewer=${viewer}&name=${encodeURIComponent(effectiveViewerName)}`
      : "/student/dashboard";

  return (
    <header className="border-b bg-white text-sm shadow-sm">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-6 py-3">
        {/* ---------------- LEFT ---------------- */}
        <div className="flex items-center space-x-3">
          {/* ✅ 관리자/선생님/학부모 공통 */}
          {(role === "admin" || role === "teacher" || role === "parent") && (
            <Link href={homePath}>
              <button
                className={`rounded-full px-3 py-1 font-medium ${
                  pathname.startsWith(homePath)
                    ? "bg-black text-white"
                    : "border border-gray-300 hover:bg-gray-100"
                }`}
              >
                {role === "admin"
                  ? "관리자홈"
                  : role === "teacher"
                  ? "선생님홈"
                  : "학부모홈"}
              </button>
            </Link>
          )}

          {/* ✅ 학생 모드 */}
          {role === "student" && !viewer && (
            <>
              <span className="rounded-full border border-gray-300 bg-white px-3 py-1 font-medium text-gray-500">
                학습관리
              </span>
              <Link href="/student">
                <button
                  className={`rounded-full px-3 py-1 font-medium ${
                    pathname === "/student"
                      ? "bg-black text-white"
                      : "border border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  플래너
                </button>
              </Link>
              <Link href="/student/dashboard">
                <button
                  className={`rounded-full px-3 py-1 font-medium ${
                    pathname.includes("/dashboard")
                      ? "bg-black text-white"
                      : "border border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  대시보드
                </button>
              </Link>
            </>
          )}

          {/* ✅ 뷰어 모드 */}
          {viewer && effectiveViewerName && (
            <>
              <Link href={plannerPath}>
                <button
                  className={`rounded-full px-3 py-1 font-medium ${
                    !isDashboard
                      ? "bg-black text-white"
                      : "border border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {effectiveViewerName} 학생 플래너
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
                  {effectiveViewerName} 학생 대시보드
                </button>
              </Link>
            </>
          )}
        </div>

        {/* ---------------- RIGHT ---------------- */}
        <div className="flex items-center space-x-2 text-gray-700">
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
