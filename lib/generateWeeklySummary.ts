import dayjs from 'dayjs';

// 주간 요약 생성 함수
export function generateWeeklySummary(sessions: any[]) {
  if (!sessions || sessions.length === 0) {
    return '이번 주 학습 기록이 없습니다.';
  }

  // 총 공부 시간 계산 (분 단위)
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalHr = Math.round(totalMinutes / 60);

  // ✅ 하루 평균 공부 시간 추가 (분 단위)
  const avgPerDay =
    sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0;

  // 과목별 통계 계산
  const subjectMap: Record<string, number> = {};
  sessions.forEach((s) => {
    if (s.subject) {
      subjectMap[s.subject] = (subjectMap[s.subject] || 0) + (s.duration || 0);
    }
  });

  const sortedSubjects = Object.entries(subjectMap)
    .sort((a, b) => b[1] - a[1])
    .map(([subject, minutes]) => `${subject} ${Math.round(minutes / 60)}시간`)
    .join(', ');

  // 과목별 요약 문자열
  const subjectStats = Object.keys(subjectMap)
    .map((key) => `${key}: ${Math.round(subjectMap[key] / 60)}시간`)
    .join(', ');

  // 텍스트 리포트 생성
  const summary = `
  [이번 주 총 공부 시간] ${totalHr}시간
  [과목별 요약] ${subjectStats}
  [하루 평균 공부시간]: ${avgPerDay}분
  [과목별 비율]: ${sortedSubjects}
  [주간 집중 패턴]: ${dayjs(sessions[0].actual_start).format('M/D')} ~ ${dayjs(
    sessions[sessions.length - 1].actual_end
  ).format('M/D')}
  `;

  return summary.trim();
}
