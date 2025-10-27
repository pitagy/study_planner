"use client";

import { usePathname, useSearchParams } from "next/navigation";
import UnifiedTopBar from "@/components/common/UnifiedTopBar";
import FloatingTimer from "@/components/planner/FloatingTimer";

export default function StudentLayoutClient({
  loginName,
  loginEmail,
  loginRole,
  children,
}: {
  loginName: string;
  loginEmail: string;
  loginRole: string;
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const pathname = usePathname();

  const viewer = params.get("viewer");
  const viewerName = params.get("name");
  const isViewer = Boolean(viewer); // ✅ 열람 모드 여부

  const isDashboard = pathname.includes("/dashboard");
  const pageLabel = isDashboard ? "대시보드" : "플래너";

  const viewerMsg =
    loginRole === "teacher"
      ? `선생님 열람 모드로 학생 ${pageLabel}를 보고 있습니다.`
      : loginRole === "admin"
      ? `관리자 열람 모드로 학생 ${pageLabel}를 보고 있습니다.`
      : loginRole === "parent"
      ? `학부모 열람 모드로 학생 ${pageLabel}를 보고 있습니다.`
      : "";

  return (
    <div className="min-h-dvh bg-gray-50">
      <UnifiedTopBar
        role={loginRole}
        name={loginName}
        email={loginEmail}
        viewerName={isViewer ? viewerName ?? null : null}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        {isViewer && viewerMsg && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
            {viewerMsg}
          </div>
        )}
        {children}
      </main>

      {/* ✅ 플로팅 타이머는 학생 본인일 때만 */}
      {!isViewer && loginRole === "student" && <FloatingTimer />}
    </div>
  );
}
