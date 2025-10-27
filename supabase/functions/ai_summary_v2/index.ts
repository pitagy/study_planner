// ────────────────────────────────────────────────
// 📘 Supabase Edge Function : ai_summary_v2 (최적화 + 조건 기반 버전)
// ────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import dayjsLib from "https://esm.sh/dayjs@1.11.10";
import utc from "https://esm.sh/dayjs@1.11.10/plugin/utc";
import tz from "https://esm.sh/dayjs@1.11.10/plugin/timezone";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.0";

dayjsLib.extend(utc);
dayjsLib.extend(tz);
dayjsLib.tz.setDefault("Asia/Seoul");
const dayjs = dayjsLib;

// ✅ 환경 변수
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 📅 ‘이전 주’ 범위 계산 (KST 기준 월~일)
function getPreviousWeekRangeKST(base: dayjsLib.Dayjs) {
  const thisMonday = base.tz().startOf("week").add(1, "day");
  const startOfPrevWeek = thisMonday.subtract(7, "day");
  const endOfPrevWeek = startOfPrevWeek.add(6, "day");
  return { startOfWeek: startOfPrevWeek, endOfWeek: endOfPrevWeek };
}

// 🧠 GPT 프롬프트 생성
function buildPrompt({ totalMin, avgPerDay, sortedSubjects, startLabel, endLabel }) {
  return `
당신은 학습 분석 AI입니다.
아래는 지난주 학생의 공부 기록입니다.
이를 기반으로 학생에게 피드백 형식의 자연어 요약을 만들어 주세요.

- 총 공부시간: ${totalMin}분
- 하루 평균: ${avgPerDay}분
- 과목별 비율: ${sortedSubjects}
- 주간 집중 패턴: ${startLabel} ~ ${endLabel}
요약은 3문장 이내, 친근하고 격려하는 말투로 작성하세요.
`.trim();
}

// 🤖 GPT 요약 요청
async function fetchSummaryFromGPT(prompt: string): Promise<string> {
  console.log("🟩 [GPT] 요청 시작");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "너는 학생의 학습 데이터를 분석해 따뜻한 피드백을 주는 교육 코치야." },
        { role: "user", content: prompt },
      ],
      max_tokens: 300,
    }),
  });

  const data = await res.json();
  console.log("🟩 [GPT] 응답:", data?.choices?.[0]?.message?.content);
  return data?.choices?.[0]?.message?.content?.trim() || "요약 생성 실패";
}

// 🚀 실행
serve(async (req) => {
  try {
    console.log("🟦 [1] 함수 호출됨");

    const { user_id } = await req.json();
    console.log("🟦 [2] 요청 Body:", user_id);

    if (!user_id) {
      console.log("🟥 [ERROR] user_id 없음");
      return new Response(JSON.stringify({ msg: "user_id required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    console.log("🟩 [3] 프로필 조회 시작");
    const { data: stu, error: stuErr } = await supabase
      .from("profiles")
      .select("id, student_name")
      .eq("id", user_id)
      .maybeSingle();
    if (stuErr) console.error("🟥 [ERROR] 프로필 조회:", stuErr);
    if (!stu) throw new Error("학생 정보 없음");

    console.log("🟩 [4] 학습데이터 조회 시작");
    const now = dayjs();
    const { startOfWeek, endOfWeek } = getPreviousWeekRangeKST(now);

    // 🟨 ① 플래너 데이터 확인 (없으면 스킵)
    const { data: sessions, error: sessErr } = await supabase
      .from("sessions")
      .select("subject, actual_start, actual_end, duration_min")
      .eq("user_id", user_id)
      .gte("actual_start", startOfWeek.toISOString())
      .lte("actual_end", endOfWeek.toISOString());

    if (sessErr) console.error("🟥 [ERROR] sessions:", sessErr);

    if (!sessions || sessions.length === 0) {
      console.log("🟨 [INFO] 지난주 학습 데이터 없음 → 스킵");
      return new Response(JSON.stringify({ msg: "No study data" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    // 🟨 ② dashboard_ai 테이블 중복 확인
    const { data: existingSummary, error: existErr } = await supabase
      .from("dashboard_ai")
      .select("id, summary")
      .eq("user_id", user_id)
      .eq("start_date", startOfWeek.format("YYYY-MM-DD"))
      .maybeSingle();

    if (existErr) console.error("🟥 [ERROR] 요약 조회:", existErr);

    if (existingSummary && existingSummary.summary && existingSummary.summary !== "요약 생성 실패") {
      console.log("🟨 [INFO] 이미 요약 존재 → GPT 요청 스킵");
      return new Response(JSON.stringify({ msg: "summary exists, skip" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    // 🟨 ③ 학습 데이터가 있고 요약이 없거나 실패일 때만 GPT 호출
    const totalMin = (sessions ?? []).reduce((acc, s) => acc + (s.duration_min ?? 0), 0);
    const daySet = new Set((sessions ?? []).map((s) => dayjs(s.actual_start).tz().format("YYYY-MM-DD")));
    const avgPerDay = Math.round(totalMin / (daySet.size || 1));

    console.log("🟩 [5] totalMin:", totalMin, "avgPerDay:", avgPerDay);

    const subjectMap: Record<string, number> = {};
    for (const s of sessions ?? []) {
      const subj = s.subject || "기타";
      subjectMap[subj] = (subjectMap[subj] || 0) + (s.duration_min ?? 0);
    }

    const sortedSubjects = Object.entries(subjectMap)
      .sort((a, b) => b[1] - a[1])
      .map(([subj, mins]) => `${subj}: ${Math.round((mins / totalMin) * 100)}%`)
      .join(", ");

    console.log("🟩 [6] 과목 비율:", sortedSubjects);

    const prompt = buildPrompt({
      totalMin,
      avgPerDay,
      sortedSubjects,
      startLabel: startOfWeek.format("M월 D일"),
      endLabel: endOfWeek.format("M월 D일"),
    });

    console.log("🟩 [7] GPT 프롬프트 생성 완료");

    const summary = await fetchSummaryFromGPT(prompt);
    console.log("🟩 [8] GPT 요약 완료");

    // 🟨 upsert: 요약이 실패 상태이거나 새로 생성 시 덮어쓰기
    const { error: upsertErr } = await supabase
      .from("dashboard_ai")
      .upsert(
        {
          id: existingSummary?.id ?? uuidv4(),
          user_id,
          start_date: startOfWeek.format("YYYY-MM-DD"),
          end_date: endOfWeek.format("YYYY-MM-DD"),
          summary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,start_date" }
      );

    if (upsertErr) console.error("🟥 [ERROR] 요약 저장 실패:", upsertErr);
    else console.log("✅ [9] 요약 저장 완료");

    return new Response(JSON.stringify({ msg: "ok", summary }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("🟥 [CRASH]", err);
    return new Response(
      JSON.stringify({ msg: "Error", error: String(err) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
});
