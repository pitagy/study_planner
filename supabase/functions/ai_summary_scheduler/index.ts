// ────────────────────────────────────────────────
// 📅 Supabase Edge Function : ai_summary_scheduler
// 매주 월요일 오전 9시(KST) 자동 실행
// ────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EDGE_FUNCTION_URL = `${SUPABASE_URL.replace(".co", ".functions.supabase.co")}/ai_summary_v2`;
const OPENAI_TRIGGER_KEY = Deno.env.get("SUPABASE_ANON_KEY"); // anon key 또는 service key 가능

serve(async () => {
  console.log("🟦 [1] 주간 요약 자동 실행 시작");

  // ① 모든 학생 조회
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "student");

  if (error) {
    console.error("🟥 [ERROR] profiles 조회 실패:", error);
    return new Response("Error fetching profiles", { status: 500 });
  }

  if (!profiles?.length) {
    console.log("🟨 [INFO] 학생 없음 → 종료");
    return new Response("No profiles", { status: 200 });
  }

  console.log(`🟩 [2] 총 ${profiles.length}명 처리 예정`);

  // ② 각 학생별로 ai_summary_v2 실행
  for (const p of profiles) {
    try {
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_TRIGGER_KEY}`,
        },
        body: JSON.stringify({ user_id: p.id }),
      });
      const txt = await res.text();
      console.log(`✅ [OK] ${p.id} →`, txt.slice(0, 80));
      await new Promise((r) => setTimeout(r, 800)); // 속도 제한 방지용 딜레이
    } catch (err) {
      console.error(`🟥 [FAIL] ${p.id}:`, err);
    }
  }

  console.log("🎯 [완료] 모든 학생 요약 요청 종료");
  return new Response("Scheduler run complete", { status: 200 });
});
