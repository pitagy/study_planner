// app/page.tsx
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Root: 로그인 후 역할에 따라 첫 화면으로 이동
 * - admin   -> /admin
 * - teacher -> /teacher
 * - parent  -> /parent
 * - student -> /student
 */
export default async function Home() {
  const supabase = getSupabaseServer();

  // 1) 세션 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const uid = user.id;

  // 2) 프로필 조회 (3회 재시도: 로그인 직후 DB 동기화 지연 방지)
  let prof = null;
  for (let i = 0; i < 3; i++) {
    const { data } = await supabase
      .from("profiles")
      .select("role, approved")
      .eq("id", uid)
      .maybeSingle();

    if (data) {
      prof = data;
      break;
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  // 3) 예외 처리
  if (!prof) redirect("/signup");
  if (!prof.approved) redirect("/pending");

  // 4) 역할별 분기
  switch (prof.role) {
    case "admin":
      redirect("/admin");
      break;
    case "teacher":
      redirect("/teacher");
      break;
    case "parent":
      redirect("/parent");
      break;
    default:
      redirect("/student");
  }
}
