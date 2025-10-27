import OpenAI from "openai";
import dayjs from "dayjs";

/**
 * 주간 공부 데이터로부터 자연어 요약을 생성
 * @param sessions 주간 학습 세션 배열 [{subject, duration_min, actual_start}, ...]
 * @returns 자연어 요약 텍스트
 */
export async function generateWeeklySummary(sessions: any[]) {
  if (!sessions || sessions.length === 0)
    return "이번 주에는 학습 기록이 없습니다.";

  // 과목별 요약 데이터
  const subjectMap: Record<string, number> = {};
  sessions.forEach((s) => {
    const subj = s.subject || "기타";
    subjectMap[subj] = (subjectMap[subj] || 0) + (s.duration_min ?? 0);
  });

  const sortedSubjects = Object.entries(subjectMap)
    .sort((a, b) => b[1] - a[1])
    .map(([subj, min]) => `${subj}: ${min}분`)
    .join(", ");

  const totalMin = sessions.reduce((acc, s) => acc + (s.duration_min ?? 0), 0);
  const avgPerDay = Math.round(totalMin / 7);
  const message = `
  당신은 학습 분석 AI입니다.
  아래는 이번 주 학생의 공부 기록입니다.
  이를 기반으로 학생에게 피드백 형식의 자연어 요약을 만들어 주세요.

  - 총 공부시간: ${totalMin}분
  - 하루 평균: ${avgPerDay}분
  - 과목별 비율: ${sortedSubjects}
  - 주간 집중 패턴: ${dayjs(sessions[0].actual_start).format("M월 D일")} ~ ${dayjs(sessions[sessions.length - 1].actual_start).format("M월 D일")}
  요약은 3문장 이내, 친근하고 격려하는 말투로 작성하세요.
  `;

  try {
    const client = new OpenAI({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "당신은 학생의 공부 리포트를 분석하는 코치입니다." },
        { role: "user", content: message },
      ],
      max_tokens: 300,
    });

    return completion.choices[0]?.message?.content?.trim() || "요약 생성에 실패했습니다.";
  } catch (err: any) {
    console.error("AI 요약 생성 오류:", err);
    return "AI 요약 생성 중 오류가 발생했습니다.";
  }
}
