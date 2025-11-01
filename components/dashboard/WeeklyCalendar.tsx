'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface VisitEventRaw {
  id: string;
  customerId: string;
  customerName: string;
  userName: string;
  date: string;
  visitDate?: string;
  status: 'SCHEDULED' | 'CHECKED' | 'NO_SHOW';
  note?: string;
  user?: {
    name: string;
  };
}

interface DayVisits {
  [userName: string]: number;
}

export default function WeeklyCalendar() {
  const router = useRouter();
  const [events, setEvents] = useState<VisitEventRaw[]>([]);
  const [loading, setLoading] = useState(true);

  // 오늘 기준 -1일, 오늘, +1일, +2일 = 총 4일 배열 생성
  const weekDays = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = -1; i <= 2; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      days.push(day);
    }
    return days;
  }, []);

  const fetchVisits = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/visit-schedules');

      if (!response.ok) {
        console.error('Failed to fetch visits:', response.status);
        setLoading(false);
        return;
      }

      const result = await response.json();

      if (result.success && result.data) {
        setEvents(result.data);
      }
    } catch (error) {
      console.error('Error fetching visits:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  // 날짜별 직원별 방문 건수 계산
  const dailyUserCounts = useMemo(() => {
    const counts: { [dateKey: string]: DayVisits } = {};
    events.forEach(event => {
      const visitDate = event.visitDate || event.date;
      if (visitDate) {
        const date = new Date(visitDate);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const userName = event.user?.name || event.userName || '직원';

        if (!counts[dateKey]) {
          counts[dateKey] = {};
        }
        counts[dateKey][userName] = (counts[dateKey][userName] || 0) + 1;
      }
    });
    return counts;
  }, [events]);

  // 4일 뷰에서는 네비게이션 불필요 (항상 오늘 기준)

  const handleDateClick = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    router.push(`/dashboard/schedules?date=${dateStr}`);
  };

  const getDayName = (date: Date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const getDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-2 space-y-3">
      {weekDays.map((date, index) => {
        const dateKey = getDateKey(date);
        const userCounts = dailyUserCounts[dateKey] || {};
        const entries = Object.entries(userCounts);
        const totalCount = entries.reduce((sum, [, count]) => sum + count, 0);
        const isTodayDate = isToday(date);

        return (
          <div key={index} className="flex gap-3 items-start">
            {/* 왼쪽: 날짜 박스 */}
            <button
              onClick={() => handleDateClick(date)}
              className={`
                flex-shrink-0 rounded-lg p-3 w-20 h-20
                border-2 transition-all duration-200
                active:scale-95 touch-manipulation
                flex flex-col items-center justify-center
                ${isTodayDate
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }
              `}
            >
              <span className={`
                text-xs font-medium
                ${isTodayDate ? 'text-blue-600' : 'text-gray-500'}
              `}>
                {getDayName(date)}
              </span>
              <span className={`
                text-2xl font-bold
                ${isTodayDate ? 'text-blue-600' : 'text-gray-900'}
              `}>
                {date.getDate()}
              </span>
            </button>

            {/* 오른쪽: 직원별 방문 일정 리스트 */}
            <div className="flex-1 space-y-1.5">
              {totalCount > 0 ? (
                entries.map(([name, count]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {name}
                    </span>
                    <span className="text-sm font-bold text-red-600">
                      +{count}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-400 py-2">
                  일정 없음
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
