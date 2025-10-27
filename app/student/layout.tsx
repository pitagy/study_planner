import { ReactNode } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";
import StudentLayoutClient from "./layoutClient";

/**
 * 학생 레이아웃
 * 관리자/선생님/학부모가 학생 플래너나 대시보드를 열람할 때도 공통 사용
 */
export default async function StudentLayout({ children }: { children: ReactNode }) {
  const supabase = getSupabaseServer();

  let userEmail = "";
  let userName = "";
  let userRole = "student";

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, email, student_name")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("⚠️ profiles 조회 오류:", error);
      }

      userEmail = profile?.email ?? user.email ?? "";
      userName = profile?.student_name ?? user.email?.split("@")[0] ?? "";

      // ✅ 역할 결정 강화 로직
      if (profile?.role) {
        userRole = profile.role;
      } else if (user.email?.includes("admin")) {
        userRole = "admin";
      } else if (user.email?.includes("teacher") || user.email?.includes("tutor")) {
        userRole = "teacher";
      } else if (user.email?.includes("parent")) {
        userRole = "parent";
      } else {
        userRole = "student";
      }

      console.log(`✅ 로그인 사용자 역할: ${userRole}, 이름: ${userName}`);
    }
  } catch (err) {
    console.error("❌ 학생 레이아웃 인증 오류:", err);
  }

  return (
    <StudentLayoutClient
      loginName={userName}
      loginEmail={userEmail}
      loginRole={userRole}
    >
      {children}
    </StudentLayoutClient>
  );
}
