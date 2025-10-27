// ────────────────────────────────────────────────
// 📘 Supabase Edge Function : ai_summary
// ────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import dayjsLib from "https://esm.sh/dayjs@1.11.10";
import utc from "https://esm.sh/dayjs@1.11.10/plugin/utc.js";
import tz from "https://esm.sh/dayjs@1.11.10/plugin/timezone.js";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.0";

dayjsLib.extend(utc);
dayjsLib.extend(tz);
dayjsLib.tz.setDefault("Asia/Seoul");
const dayjs = dayjsLib;

// ✅ 환경변수
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 🧠 GPT 프롬프트 생성
function buildPrompt({
  totalMin,
  avgPerDay,
  sortedSubjects,
  startLabel,
  endLabel,
}: {
  totalMin: number;
  avgPerDay: number;
  sortedSubjects: string;
  startLabel: string;
  endLabel: string;
}) {
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
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "너는 학생의 학습 데이터를 분석해 따뜻한 피드백을 주는 교육 코치야.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 350,
    }),
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "요약 생성 실패";
}

// 📅 ‘이전 주’ 범위 계산 (KST 기준 월~일)
function getPreviousWeekRangeKST(base: dayjsLib.Dayjs) {
  const thisMonday = base.tz().startOf("week").add(1, "day"); // 이번 주 월요일
  const startOfPrevWeek = thisMonday.subtract(7, "day"); // 이전 주 월요일
  const endOfPrevWeek = startOfPrevWeek.add(6, "day"); // 이전 주 일요일
  return { startOfWeek: startOfPrevWeek, endOfWeek: endOfPrevWeek };
}

// 🏁 Edge Function 시작
serve(async (req) => {
  try {
    console.log("🟦 [1] Function invoked");

    const url = new URL(req.url);
    console.log("🟦 [2] URL parsed:", url.href);

    const { user_id } = await req.json();
    console.log("🟦 [3] Body parsed, user_id =", user_id);

    if (!user_id) {
      console.log("🟥 [ERROR] user_id missing");
      return new Response(
        JSON.stringify({ msg: "user_id required" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    console.log("🟩 [4] Fetching student profile…");
    const { data: stu, error: err1 } = await supabase
      .from("profiles")
      .select("id, student_name")
      .eq("id", user_id)
      .maybeSingle();

    if (err1) console.error("🟥 [ERROR] profile fetch:", err1);
    if (!stu) throw new Error("학생 정보 없음");

    console.log("🟩 [5] Fetching plans/sessions…");
    const now = dayjs();
    const { startOfWeek, endOfWeek } = getPreviousWeekRangeKST(now);

    const [{ data: plans }, { data: sessions }] = await Promise.all([
      supabase.from("plans")
        .select("subject, start_at, end_at")
        .eq("user_id", user_id)
        .gte("start_at", startOfWeek.toISOString())
        .lte("end_at", endOfWeek.toISOString()),
      supabase.from("sessions")
        .select("subject, actual_start, actual_end, duration_min")
        .eq("user_id", user_id)
        .gte("actual_start", startOfWeek.toISOString())
        .lte("actual_end", endOfWeek.toISOString()),
    ]);

    console.log("🟩 [6] plans:", plans?.length, "sessions:", sessions?.length);

    if (!plans?.length && !sessions?.length)
      return new Response(JSON.stringify({ msg: "No study data" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    console.log("🟩 [7] Calculating stats…");
    const totalMin = sessions.reduce((a, s) => a + (s.duration_min ?? 0), 0);
    const avgPerDay = Math.round(totalMin / (new Set(sessions.map(s => dayjs(s.actual_start).format("YYYY-MM-DD"))).size || 1));

    console.log("🟩 [8] totalMin:", totalMin, "avgPerDay:", avgPerDay);

    console.log("🟩 [9] Generating prompt…");
    const prompt = buildPrompt({
      totalMin,
      avgPerDay,
      sortedSubjects: "TODO",
      startLabel: startOfWeek.format("M월 D일"),
      endLabel: endOfWeek.format("M월 D일"),
    });

    console.log("🟩 [10] Calling OpenAI API…");
    const summary = await fetchSummaryFromGPT(prompt);
    console.log("🟩 [11] Summary:", summary);

    console.log("🟩 [12] Inserting into dashboard_ai…");
    await supabase.from("dashboard_ai").insert([
      {
        id: uuidv4(),
        user_id,
        start_date: startOfWeek.format("YYYY-MM-DD"),
        end_date: endOfWeek.format("YYYY-MM-DD"),
        summary,
      },
    ]);

    console.log("✅ [13] Success for", user_id);
    return new Response(JSON.stringify({ msg: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  } catch (err) {
    console.error("🟥 [CRASH] ", err);
    return new Response(
      JSON.stringify({ msg: "Error", error: String(err) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
});

