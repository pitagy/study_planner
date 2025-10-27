// ────────────────────────────────────────────────
// 📘 Supabase Edge Function : ai_summary_v3 (정교 분석 + 행동 피드백)
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
function buildPrompt({
  studentName,
  totalMin,
  avgPerDay,
  planAchievement,
  subjectRatios,
  dayPattern,
  hourPattern,
  consistencyScore,
  startLabel,
  endLabel,
}: any) {
  return `
당신은 학생의 학습 플래너 데이터를 분석하여
개인 맞춤형 피드백을 제공하는 AI 교육 코치입니다.

학생 이름: ${studentName}
분석 기간: ${startLabel} ~ ${endLabel}

[학습 통계 요약]
- 총 공부시간: ${totalMin}분
- 하루 평균: ${avgPerDay}분
- 계획 이행률: ${planAchievement}%
- 과목별 비중: ${subjectRatios}
- 요일별 집중 패턴: ${dayPattern}
- 시간대별 집중도: ${hourPattern}
- 루틴 안정성 지수(연속 학습일수 기반): ${consistencyScore}

[작성 지침]
1️⃣ 학생의 루틴, 집중시간대, 과목 균형을 종합적으로 분석하세요.
2️⃣ 학습량, 실천력, 집중패턴 측면에서 강점과 약점을 명확히 기술하세요.
3️⃣ 루틴 안정성과 시간대 패턴을 고려하여, 다음 주를 위한 구체적 개선 조언을 제시하세요.
4️⃣ 피드백은 아래 3단 구성으로 작성하세요.
   - 🔹 학습 요약 (객관적 분석)
   - 🔹 개선 포인트 (구체적 행동 제안)
   - 🔹 격려 멘트 (동기부여 중심)
5️⃣ 글은 5문장 이내로 작성하되, 현실적이고 따뜻한 어조로 표현하세요.
6️⃣ 무조건적인 칭찬 대신 실질적 피드백을 포함하세요.
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
        { role: "system", content: "너는 학생의 학습 데이터를 분석하여 성실하고 따뜻한 피드백을 주는 교육 코치야." },
        { role: "user", content: prompt },
      ],
      max_tokens: 400,
    }),
  });

  const data = await res.json();
  console.log("🟩 [GPT 응답]:", data?.choices?.[0]?.message?.content);
  return data?.choices?.[0]?.message?.content?.trim() || "요약 생성 실패";
}

// 🚀 실행 시작
serve(async (req) => {
  try {
    const { user_id } = await req.json();
    console.log("🟦 [1] 함수 호출됨:", user_id);
    if (!user_id) throw new Error("user_id required");

    const now = dayjs();
    const { startOfWeek, endOfWeek } = getPreviousWeekRangeKST(now);

    // 🟩 학생 프로필 조회
    const { data: stu } = await supabase
      .from("profiles")
      .select("id, student_name")
      .eq("id", user_id)
      .maybeSingle();
    if (!stu) throw new Error("학생 정보 없음");

    // 🟩 지난주 학습 세션 조회
    const { data: sessions } = await supabase
      .from("sessions")
      .select("subject, actual_start, duration_min")
      .eq("user_id", user_id)
      .gte("actual_start", startOfWeek.toISOString())
      .lte("actual_start", endOfWeek.toISOString());

    if (!sessions || sessions.length === 0)
      return new Response(JSON.stringify({ msg: "No data" }), { status: 200 });

    // 🟩 지난주 계획 데이터 조회
    const { data: plans } = await supabase
      .from("plans")
      .select("subject, estimated_min, start_at")
      .eq("user_id", user_id)
      .gte("start_at", startOfWeek.toISOString())
      .lte("start_at", endOfWeek.toISOString());

    // 🟩 총 공부시간 및 계획 대비 실천율 계산
    const totalMin = sessions.reduce((a, b) => a + (b.duration_min ?? 0), 0);
    const planTotal = plans?.reduce((a, b) => a + (b.estimated_min ?? 0), 0) || 0;
    const planAchievement = planTotal > 0 ? Math.round((totalMin / planTotal) * 100) : 0;

    // 🟩 요일별 집중 패턴
    const dayPattern = Array.from({ length: 7 }, (_, i) => {
      const day = dayjs(startOfWeek).add(i, "day").format("ddd");
      const sum = sessions
        .filter((s) => dayjs(s.actual_start).day() === i)
        .reduce((a, b) => a + (b.duration_min ?? 0), 0);
      return `${day}: ${sum}분`;
    }).join(", ");

    // 🟩 시간대별 집중도
    const hourMap = { 오전: 0, 오후: 0, 야간: 0 };
    sessions.forEach((s) => {
      const hour = dayjs(s.actual_start).hour();
      if (hour < 12) hourMap.오전 += s.duration_min ?? 0;
      else if (hour < 18) hourMap.오후 += s.duration_min ?? 0;
      else hourMap.야간 += s.duration_min ?? 0;
    });
    const hourPattern = Object.entries(hourMap)
      .map(([k, v]) => `${k}: ${Math.round((v / totalMin) * 100)}%`)
      .join(", ");

    // 🟩 과목별 비중
    const subjectMap: Record<string, number> = {};
    for (const s of sessions) {
      subjectMap[s.subject || "기타"] = (subjectMap[s.subject || "기타"] || 0) + (s.duration_min ?? 0);
    }
    const subjectRatios = Object.entries(subjectMap)
      .sort((a, b) => b[1] - a[1])
      .map(([subj, min]) => `${subj}: ${Math.round((min / totalMin) * 100)}%`)
      .join(", ");

    // 🟩 루틴 안정성 (연속 공부일수)
    const studyDays = Array.from(
      new Set(sessions.map((s) => dayjs(s.actual_start).format("YYYY-MM-DD")))
    ).sort();
    let maxStreak = 1, current = 1;
    for (let i = 1; i < studyDays.length; i++) {
      const prev = dayjs(studyDays[i - 1]);
      const curr = dayjs(studyDays[i]);
      if (curr.diff(prev, "day") === 1) current++;
      else current = 1;
      maxStreak = Math.max(maxStreak, current);
    }

    const consistencyScore = Math.min(100, maxStreak * 14); // 최대 100점 환산

    // 🧠 GPT 프롬프트 생성
    const prompt = buildPrompt({
      studentName: stu.student_name,
      totalMin,
      avgPerDay: Math.round(totalMin / (studyDays.length || 1)),
      planAchievement,
      subjectRatios,
      dayPattern,
      hourPattern,
      consistencyScore,
      startLabel: startOfWeek.format("M월 D일"),
      endLabel: endOfWeek.format("M월 D일"),
    });

    // 🤖 GPT 요약 생성
    const summary = await fetchSummaryFromGPT(prompt);

    // 🟩 DB 저장 (업서트)
    await supabase
      .from("dashboard_ai")
      .upsert({
        id: uuidv4(),
        user_id,
        start_date: startOfWeek.format("YYYY-MM-DD"),
        end_date: endOfWeek.format("YYYY-MM-DD"),
        summary,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,start_date" });

    console.log("✅ [완료] 요약 저장:", summary);
    return new Response(JSON.stringify({ msg: "ok", summary }), { status: 200 });
  } catch (err) {
    console.error("🟥 [CRASH]", err);
    return new Response(JSON.stringify({ msg: "Error", error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
