// ────────────────────────────────────────────────
// 📘 Supabase Edge Function : ai_summary
// 로컬에서는 Authorization 검사 비활성화
// 배포 시 JWT 인증 활성화
// ────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import dayjsLib from "npm:dayjs";
import utc from "npm:dayjs/plugin/utc";
import tz from "npm:dayjs/plugin/timezone";
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
    const url = new URL(req.url);

    // ✅ 모든 로컬 실행 환경 감지 (localhost, 127.x, 0.0.0.0, ::1, 172.x 등)
    const isLocal =
      ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname) ||
      url.hostname.startsWith("172.") ||
      Deno.env.get("SUPABASE_ENV") === "local" ||
      Deno.env.get("IS_LOCAL") === "true";

    // ✅ 로컬이면 Authorization 검사 생략
    if (!isLocal) {
      const auth = req.headers.get("authorization");
      if (!auth) {
        return new Response(
          JSON.stringify({ msg: "Error: Missing authorization header" }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          }
        );
      }

      const token = auth.replace("Bearer ", "").trim();
      const { data: authData, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !authData?.user) {
        return new Response(JSON.stringify({ msg: "Invalid JWT" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
    } else {
      console.log("🧩 Local mode detected — Authorization check skipped");
    }

    // ✅ 요청 본문
    const { user_id } = await req.json();
    if (!user_id)
      return new Response(
        JSON.stringify({ msg: "user_id required" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );

    console.log("📩 Received user_id:", user_id);

    const now = dayjs();
    const { startOfWeek, endOfWeek } = getPreviousWeekRangeKST(now);

    console.log(
      "🗓️ Generating summaries for previous week:",
      startOfWeek.format("YYYY-MM-DD"),
      "to",
      endOfWeek.format("YYYY-MM-DD")
    );

    // 1️⃣ 학생 정보 확인
    const { data: stu } = await supabase
      .from("profiles")
      .select("id, role, name:student_name")
      .eq("id", user_id)
      .maybeSingle();

    if (!stu) throw new Error("학생 정보 없음");

    // 2️⃣ 학습데이터 조회
    const [{ data: plans }, { data: sessions }] = await Promise.all([
      supabase
        .from("plans")
        .select("subject,start_at,end_at")
        .eq("user_id", user_id)
        .gte("start_at", startOfWeek.toISOString())
        .lte("end_at", endOfWeek.toISOString()),
      supabase
        .from("sessions")
        .select("subject,actual_start,actual_end,duration_min")
        .eq("user_id", user_id)
        .gte("actual_start", startOfWeek.toISOString())
        .lte("actual_end", endOfWeek.toISOString()),
    ]);

    const plansArr = plans ?? [];
    const sessionsArr = sessions ?? [];

    if (sessionsArr.length === 0 && plansArr.length === 0)
      return new Response(
        JSON.stringify({ msg: "No study data" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );

    // 총 공부시간
    const totalMin = sessionsArr.reduce(
      (acc, s) => acc + (s.duration_min ?? 0),
      0
    );
    if (totalMin <= 0)
      return new Response(
        JSON.stringify({ msg: "Empty duration" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );

    // 하루 평균
    const daySet = new Set(
      sessionsArr.map((s) => dayjs(s.actual_start).tz().format("YYYY-MM-DD"))
    );
    const avgPerDay = Math.round(totalMin / (daySet.size || 1));

    // 과목별 비율
    const subjectMap: Record<string, number> = {};
    for (const s of sessionsArr) {
      const subj = s.subject || "기타";
      subjectMap[subj] = (subjectMap[subj] || 0) + (s.duration_min ?? 0);
    }
    const sortedSubjects = Object.entries(subjectMap)
      .sort((a, b) => b[1] - a[1])
      .map(([subj, mins]) => `${subj}: ${Math.round((mins / totalMin) * 100)}%`)
      .join(", ");

    const sortedSessions = [...sessionsArr].sort(
      (a, b) => dayjs(a.actual_start).valueOf() - dayjs(b.actual_start).valueOf()
    );
    const startLabel = dayjs(sortedSessions[0].actual_start)
      .tz()
      .format("M월 D일");
    const endLabel = dayjs(sortedSessions[sortedSessions.length - 1].actual_start)
      .tz()
      .format("M월 D일");

    // 중복 방지: 이미 요약된 주차는 건너뜀
    const { data: existing } = await supabase
      .from("dashboard_ai")
      .select("id")
      .eq("user_id", user_id)
      .eq("start_date", startOfWeek.format("YYYY-MM-DD"))
      .eq("end_date", endOfWeek.format("YYYY-MM-DD"))
      .maybeSingle();

    if (existing?.id)
      return new Response(
        JSON.stringify({ msg: "Already summarized" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );

    // GPT 요약 생성
    const prompt = buildPrompt({
      totalMin,
      avgPerDay,
      sortedSubjects,
      startLabel,
      endLabel,
    });
    const summary = await fetchSummaryFromGPT(prompt);

    // 저장
    await supabase.from("dashboard_ai").insert([
      {
        id: uuidv4(),
        user_id,
        start_date: startOfWeek.format("YYYY-MM-DD"),
        end_date: endOfWeek.format("YYYY-MM-DD"),
        summary,
      },
    ]);

    console.log("✅ Weekly summary created successfully for:", user_id);
    return new Response(
      JSON.stringify({ msg: "ok", summary }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ Error:", err);
    return new Response(
      JSON.stringify({ msg: "Error", error: String(err) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
});
