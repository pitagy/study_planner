'use client';

import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import * as SB from '@/lib/supabaseClient';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

import AIWeeklySummary from './AIWeeklySummary';
import TodayMemoSection from './TodayMemoSection';
import DailySummarySection from './DailySummarySection';
import StudyHeatmap from './StudyHeatmap';

import PlanActualCard from './PlanActualCard';
import SubjectFocusCard from './SubjectFocusCard';
import WeeklyChangeCard from './WeeklyChangeCard';
import WeeklySummaryCard from './WeeklySummaryCard';
import TimeOfDayFocusCard from './TimeOfDayFocusCard';
import MonthlyTotalCard from './MonthlyTotalCard';
import AccumulatedFocusCard from './AccumulatedFocusCard';
import TodayEfficiencyCard from './TodayEfficiencyCard';

export default function ViewerDashboard({ viewerId, viewerName }: any) {
  const supabase = useMemo(() => (SB as any).getSupabaseClient(), []);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [displayName, setDisplayName] = useState('나의 대시보드');
  const [userId, setUserId] = useState<string | null>(null);
  const [studyData, setStudyData] = useState<any[]>([]);
  const router = useRouter();

  // ✅ 로그인된 사용자 ID 확인
  useEffect(() => {
    async function getCurrentUser() {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    getCurrentUser();
  }, []);

  // ✅ "나의 대시보드" or "○○ 학생의 대시보드" 구분
  useEffect(() => {
    if (!userId) return;
    if (userId === viewerId) setDisplayName('나의 대시보드');
    else setDisplayName(`${viewerName ?? '학생'}의 대시보드`);
  }, [userId, viewerId, viewerName]);

  // ✅ 히트맵용 데이터 로드 (study_days 테이블 기반)
  useEffect(() => {
    async function loadStudyData() {
      if (!viewerId) return;
      try {
        const { data, error } = await supabase
          .from('study_days') // ✅ 존재하는 테이블로 교체
          .select('date, total_seconds, plan_seconds')
          .eq('user_id', viewerId)
          .order('date', { ascending: true });

        if (error) {
          console.error('🔥 study_days 불러오기 오류:', error);
          setStudyData([]);
          return;
        }

        // 초 → 분 단위로 변환
        const mapped = (data || []).map((row) => ({
          date: row.date,
          plan_min: Math.round((row.plan_seconds || 0) / 60),
          total_min: Math.round((row.total_seconds || 0) / 60),
        }));

        setStudyData(mapped);
      } catch (err) {
        console.error('🔥 예외 발생:', err);
        setStudyData([]);
      }
    }

    loadStudyData();
  }, [viewerId, supabase]);

  return (
    <main className="p-6 space-y-8">
      {/* ✅ 대시보드 제목 */}
      <h1 className="text-2xl font-bold mb-2">{displayName}</h1>

      {/* ✅ AI 학습 요약 */}
      <AIWeeklySummary supabase={supabase} viewerId={viewerId} />

      {/* ✅ 학습 히트맵 */}
      <section className="border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="font-semibold mb-3 text-gray-700">📅 학습 히트맵</h2>
        <StudyHeatmap
          supabase={supabase}
          viewerId={viewerId}
          selectedDate={selectedDate}
          onDateSelect={(date: string) => setSelectedDate(date)}
        />
      </section>


      {/* ✅ 오늘의 학습 요약 */}
      <DailySummarySection
        supabase={supabase}
        viewerId={viewerId}
        selectedDate={selectedDate}
      />
	  
	        {/* ✅ 오늘의 메모 */}
      <TodayMemoSection
        supabase={supabase}
        viewerId={viewerId}
        selectedDate={selectedDate}
      />
	  
      {/* ✅ 하단 분석 카드 영역 */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PlanActualCard viewerId={viewerId} />
        <SubjectFocusCard viewerId={viewerId} />
        <WeeklyChangeCard viewerId={viewerId} />
        <WeeklySummaryCard viewerId={viewerId} />
        <TimeOfDayFocusCard viewerId={viewerId} />
        <TodayEfficiencyCard viewerId={viewerId} />
        <MonthlyTotalCard viewerId={viewerId} />
        <AccumulatedFocusCard viewerId={viewerId} />
      </section>
    </main>
  );
}
