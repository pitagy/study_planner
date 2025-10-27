'use client';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';

export default function StudyHeatmap({ supabase, viewerId, selectedDate, onDateSelect }: any) {
  const [heatmapDays, setHeatmapDays] = useState<any[]>([]);
  const [memoCounts, setMemoCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(dayjs(selectedDate));

  const generateMonthDays = (date: string) => {
    const startOfMonth = dayjs(date).startOf('month');
    const endOfMonth = dayjs(date).endOf('month');
    const days: { date: string; plan_min: number; total_min: number }[] = [];
    for (let d = startOfMonth; d.isBefore(endOfMonth) || d.isSame(endOfMonth); d = d.add(1, 'day')) {
      days.push({ date: d.format('YYYY-MM-DD'), plan_min: 0, total_min: 0 });
    }
    return days;
  };

  const loadMonthData = async () => {
    if (!viewerId) return;
    setLoading(true);

    const startOfMonth = dayjs(currentMonth).startOf('month').toISOString();
    const endOfMonth = dayjs(currentMonth).endOf('month').toISOString();

    const { data: plans } = await supabase
      .from('plans')
      .select('start_at,end_at')
      .eq('user_id', viewerId)
      .gte('start_at', startOfMonth)
      .lte('end_at', endOfMonth);

    const { data: sessions } = await supabase
      .from('sessions')
      .select('actual_start,actual_end,duration_min')
      .eq('user_id', viewerId)
      .gte('actual_start', startOfMonth)
      .lte('actual_end', endOfMonth);

    const dailyMap: Record<string, { plan: number; total: number }> = {};

    (plans || []).forEach((p) => {
      const date = dayjs(p.start_at).format('YYYY-MM-DD');
      const dur = dayjs(p.end_at).diff(dayjs(p.start_at), 'minute');
      dailyMap[date] = dailyMap[date] || { plan: 0, total: 0 };
      dailyMap[date].plan += Math.max(0, dur);
    });

    (sessions || []).forEach((s) => {
      const date = dayjs(s.actual_start).format('YYYY-MM-DD');
      const dur = s.duration_min ?? dayjs(s.actual_end).diff(dayjs(s.actual_start), 'minute');
      dailyMap[date] = dailyMap[date] || { plan: 0, total: 0 };
      dailyMap[date].total += Math.max(0, dur);
    });

    const { data: comments } = await supabase
      .from('dashboard_comments')
      .select('date')
      .eq('user_id', viewerId)
      .gte('date', dayjs(currentMonth).startOf('month').format('YYYY-MM-DD'))
      .lte('date', dayjs(currentMonth).endOf('month').format('YYYY-MM-DD'));

    const memoCountMap: Record<string, number> = {};
    comments?.forEach((c: any) => {
      memoCountMap[c.date] = (memoCountMap[c.date] || 0) + 1;
    });
    setMemoCounts(memoCountMap);

    const baseDays = generateMonthDays(currentMonth.format('YYYY-MM-DD'));
    const merged = baseDays.map((d) => ({
      date: d.date,
      plan_min: dailyMap[d.date]?.plan ?? 0,
      total_min: dailyMap[d.date]?.total ?? 0,
    }));

    setHeatmapDays(merged);
    setLoading(false);
  };

  useEffect(() => {
    if (!viewerId) return;
    loadMonthData();
  }, [viewerId, currentMonth]);

  const formatTime = (minutes: number) => {
    if (minutes <= 0) return '0분';
    if (minutes < 60) return `${Math.round(minutes)}분`;
    const hours = minutes / 60;
    return `${hours.toFixed(1)}h`;
  };

  // ✅ teal 계열 파스텔 색상 + 밝기 기준 텍스트 자동 조정
  const getColor = (plan: number, total: number) => {
    if (plan <= 0 && total <= 0) return { bg: 'bg-gray-200', text: 'text-gray-800' };

    const hours = total / 60;
    if (hours >= 10) return { bg: 'bg-teal-500', text: 'text-white' };
    if (hours >= 8) return { bg: 'bg-teal-400', text: 'text-white' };
    if (hours >= 5) return { bg: 'bg-teal-300', text: 'text-gray-900' };
    if (hours >= 2) return { bg: 'bg-teal-200', text: 'text-gray-900' };
    if (hours > 0) return { bg: 'bg-teal-100', text: 'text-gray-800' };
    return { bg: 'bg-teal-50', text: 'text-gray-800' };
  };

  const today = dayjs().format('YYYY-MM-DD');
  const firstDay = dayjs(currentMonth).startOf('month');
  const firstWeekday = firstDay.day() === 0 ? 7 : firstDay.day();

  /** 🔹 월 이동 함수 */
  const goPrevMonth = () => setCurrentMonth(currentMonth.subtract(1, 'month'));
  const goNextMonth = () => setCurrentMonth(currentMonth.add(1, 'month'));
  const goThisMonth = () => setCurrentMonth(dayjs());

  return (
    <section className="bg-white rounded-xl p-4 border">
      {/* ✅ 상단 타이틀만 남기고 버튼 우측 정렬 */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-lg"> </h2>
        <div className="flex gap-2">
          <button
            onClick={goPrevMonth}
            className="px-2 py-1 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
          >
            이전달
          </button>
          <button
            onClick={goThisMonth}
            className="px-2 py-1 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
          >
            이번달
          </button>
          <button
            onClick={goNextMonth}
            className="px-2 py-1 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
          >
            다음달
          </button>
        </div>
      </div>

      {/* ✅ 현재 월 표시 */}
      <p className="text-sm text-gray-500 mb-3">
        {currentMonth.format('YYYY년 M월')}
      </p>

      {loading ? (
        <div className="text-gray-400 text-sm text-center py-6">히트맵 데이터를 불러오는 중...</div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-2 text-center text-sm text-gray-500 mb-2">
            {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstWeekday - 1 }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {heatmapDays.map((d) => {
              const isToday = d.date === today;
              const isSelected = d.date === selectedDate;
              const memoCount = memoCounts[d.date] || 0;
              const color = getColor(d.plan_min, d.total_min);

              return (
                <button
                  key={d.date}
                  onClick={() => onDateSelect(d.date)}
                  className={`relative flex flex-col items-center justify-center aspect-square rounded-lg transition-all duration-150 ${color.bg} ${color.text} ${
                    isSelected ? 'ring-2 ring-teal-400' : ''
                  } ${isToday ? 'border border-teal-700' : ''} hover:scale-105`}
                  title={`${dayjs(d.date).format('M월 D일')} — 계획 ${formatTime(d.plan_min)} / 실제 ${formatTime(
                    d.total_min
                  )}`}
                >
                  <span className="text-xs font-medium">{dayjs(d.date).date()}</span>
                  {(d.plan_min > 0 || d.total_min > 0) && (
                    <span className="text-[10px] opacity-90">
                      (계획 {formatTime(d.plan_min)} / 실제 {formatTime(d.total_min)})
                    </span>
                  )}
                  {memoCount > 0 && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full shadow-md"></span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
