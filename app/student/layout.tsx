// app/student/layout.tsx
import type { ReactNode } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import StudentHeaderClient from "@/components/student/StudentHeader.client";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      {/* 상단바: 학생 본인 = UserTopBar + Nav / 뷰어모드 = 뷰어 전용 헤더 */}
      <StudentHeaderClient />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </RequireAuth>
  );
}
