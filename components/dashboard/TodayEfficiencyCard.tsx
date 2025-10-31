'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import * as SB from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

const pickSupabase = () =>
  typeof (SB as any).getSupabaseBrowser === 'function'
    ? (SB as any).getSupabaseBrowser()
    : (SB as any).getSupabaseClient();

/** ✅ 시간을 "00시간 00분" 형식으로 변환 */
const formatTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}시간 ${String(m).padStart(2, '0')}분`;
};

/** ✅ 툴팁 */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    const val = payload[0].value ?? 0;
    return (
      <div className="bg-white border border-gray-300 rounded p-2 text-sm shadow-md">
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-blue-600">{`공부시간: ${formatTime(val)}`}</p>
      </div>
    );
  }
  return null;
};

export default function TodayEfficiencyCard({
  viewerId,
}: {
  viewerId: string;
}) {
  const supabase = useMemo(() => pickSupabase(), []);
  const [planMin, setPlanMin] = useState(0);
  const [actualMin, setActualMin] = useState(0);
  const [efficiency, setEfficiency] = useState(0);
  const [comment, setComment] = useState('');
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (viewerId) loadData();
  }, [viewerId]);

  const loadData = async () => {
    const today = dayjs().format('YYYY-MM-DD');

    // ✅ plans_kst_view (계획)
    const { data: planRows, error: planErr } = await supabase
      .from('plans_kst_view')
      .select('subject, start_kst, end_kst, date_kst')
      .eq('user_id', viewerId)
      .eq('date_kst', today);
    if (planErr) console.error(planErr);

    const planMap: Record<string, number> = {};
    let totalPlan = 0;
    (planRows || []).forEach((p) => {
      const diff = dayjs(p.end_kst).diff(dayjs(p.start_kst), 'minute');
      planMap[p.subject || '기타'] = (planMap[p.subject || '기타'] || 0) + diff;
      totalPlan += diff;
    });

    // ✅ sessions_kst_view (실제)
    const { data: sessRows, error: sessErr } = await supabase
      .from('sessions_kst_view')
      .select('subject, duration_min, date_kst')
      .eq('user_id', viewerId)
      .eq('date_kst', today);
    if (sessErr) console.error(sessErr);

    const actualMap: Record<string, number> = {};
    let totalActual = 0;
    (sessRows || []).forEach((s) => {
      actualMap[s.subject || '기타'] =
        (actualMap[s.subject || '기타'] || 0) + (s.duration_min ?? 0);
      totalActual += s.duration_min ?? 0;
    });

    // ✅ 차트 데이터 병합
    const allSubjects = Array.from(
      new Set([...Object.keys(planMap), ...Object.keys(actualMap)])
    );
    const merged = allSubjects.map((sub) => ({
      과목: sub,
      공부시간: actualMap[sub] || 0,
    }));
    setData(merged);

    // ✅ 효율 계산
    const rate = totalPlan ? Math.round((totalActual / totalPlan) * 100) : 0;
    setPlanMin(totalPlan);
    setActualMin(totalActual);
    setEfficiency(rate);

    // ✅ 코멘트 생성
    const msg =
      rate === 0
        ? '오늘은 아직 공부가 시작되지 않았어요.'
        : rate < 40
        ? '아직 갈 길이 멀어요! 조금 더 힘내볼까요? 💪'
        : rate < 80
        ? '좋아요! 그래도 조금만 더 밀어붙여요! 🔥'
        : rate < 100
        ? '멋져요! 거의 완벽에 가까워요! 🌟'
        : '완벽 그 자체입니다! 대단해요 👏';
    setComment(msg);
  };

  return (
    <Card className="border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardContent className="p-5 space-y-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          🔥 오늘의 효율 분석
        </h3>

        {/* ✅ 원형 게이지 */}
        <div className="w-32 mx-auto">
          <CircularProgressbar
            value={efficiency}
            text={`${efficiency}%`}
            styles={buildStyles({
              pathColor:
                efficiency >= 90
                  ? '#16a34a'
                  : efficiency >= 70
                  ? '#facc15'
                  : '#ef4444',
              textColor: '#1f2937',
              trailColor: '#e5e7eb',
              textSize: '24px',
            })}
          />
        </div>

        {/* ✅ 효율 요약 */}
        <div className="text-center text-sm mt-3">
          <p>
            계획 공부시간:{' '}
            <span className="font-semibold text-blue-600">
              {formatTime(planMin)}
            </span>{' '}
            / 실제 공부시간:{' '}
            <span className="font-semibold text-emerald-600">
              {formatTime(actualMin)}
            </span>
          </p>
          <p className="mt-2 text-gray-700">{comment}</p>
        </div>

        {/* ✅ 과목별 그래프 */}
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey="과목" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="공부시간" fill="#60a5fa" barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
