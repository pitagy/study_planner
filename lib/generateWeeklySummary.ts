import OpenAI from "openai";

/**
 * Supabase에서 불러온 세션 데이터를 기반으로 GPT 요약문 생성
 * @param weekSessions - 이번 주 학습 세션 배열
 * @returns 주간 AI 학습 요약 텍스트
 */
export async function generateWeeklySummary(weekSessions: any[]): Promise<string> {
  try {
    // ✅ API 키 확인
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ OpenAI API 키가 설정되어 있지 않습니다. AI 요약이 생성되지 않습니다.");
      return "AI 요약을 생성할 수 없습니다. 관리자에게 문의하세요.";
    }

    const client = new OpenAI({ apiKey });

    if (!weekSessions || weekSessions.length === 0) {
      return "이번 주에는 기록된 공부 세션이 없습니다.";
    }

    // ✅ 과목별 통계 계산
    const subjectMap: Record<string, { count: number; totalMin: number }> = {};
    for (const s of weekSessions) {
      const subject = s.subject || "기타";
      const mins = s.duration_min ?? 0;
      subjectMap[subject] = {
        count: (subjectMap[subject]?.count || 0) + 1,
        totalMin: (subjectMap[subject]?.totalMin || 0) + mins,
      };
    }

    const totalMin = Object.values(subjectMap).reduce((sum, s) => sum + s.totalMin, 0);
    const totalHr = (totalMin / 60).toFixed(1);
    const subjectStats = Object.entries(subjectMap)
      .map(([k, v]) => `${k}: ${(v.totalMin / 60).toFixed(1)}시간 (${v.count}회)`)
      .join(", ");

    // ✅ 프롬프트 작성
    const prompt = `
당신은 학습 분석 전문가입니다.
다음은 한 학생의 이번 주 공부 기록입니다. 
공부 세션별로 과목과 공부 시간을 바탕으로, 학습 패턴과 특징을 분석하고, 
집중력이 높았던 과목 / 부족했던 영역 / 앞으로의 개선 방향을 간결하게 요약해 주세요.
한국어로 3~5문장 이내로, 부드럽고 학생 중심의 어조로 작성해 주세요.

[이번 주 총 공부 시간] ${totalHr}시간
[과목별 요약] ${subjectStats}
[하루 평균 공부시간 ]: ${avgPerDay}분
[과목별 비율]: ${sortedSubjects}
[주간 집중 패턴: ${dayjs(sessions[0].actual_start).format("M월 D일")} ~ ${dayjs(sessions[sessions.length - 1].actual_start).format("M월 D일")}
    `;

    // ✅ GPT 호출
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "너는 학생의 공부 기록을 분석하여 격려와 피드백을 주는 학습 코치야.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const summary = response.choices[0].message?.content?.trim();
    return summary || "이번 주 학습 요약을 생성할 수 없습니다.";
  } catch (error) {
    console.error("🧠 AI 요약 생성 오류:", error);
    return "AI 요약 생성 중 오류가 발생했습니다.";
  }
}
