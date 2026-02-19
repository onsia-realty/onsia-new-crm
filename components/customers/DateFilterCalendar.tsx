'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DailyCount {
  date: string;
  total: number;
  byUser: Array<{
    userId: string;
    name: string;
    count: number;
  }>;
}

interface DateFilterCalendarProps {
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
  userId?: string | null;
  viewAll?: boolean;
  buttonText?: string;
}

export function DateFilterCalendar({
  selectedDate,
  onDateSelect,
  userId,
  viewAll = false,
  buttonText = '날짜별 보기',
}: DateFilterCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const [loading, setLoading] = useState(false);

  // 날짜별 등록 수 조회
  const fetchDailyCounts = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/customers/daily-counts?year=${currentYear}&month=${currentMonth}`;

      if (userId) {
        url += `&userId=${userId}`;
      } else if (viewAll) {
        url += `&viewAll=true`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        setDailyCounts(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching daily counts:', error);
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth, userId, viewAll]);

  useEffect(() => {
    if (isOpen) {
      fetchDailyCounts();
    }
  }, [isOpen, fetchDailyCounts]);

  // 날짜별 카운트 맵 생성
  const countMap = new Map<string, DailyCount>();
  dailyCounts.forEach((item) => {
    countMap.set(item.date, item);
  });

  // 캘린더 데이터 생성
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  // 이전/다음 달 이동
  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 날짜 클릭 처리
  const handleDateClick = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // 같은 날짜를 다시 클릭하면 선택 해제
    if (selectedDate === dateStr) {
      onDateSelect(null);
    } else {
      onDateSelect(dateStr);
    }
    setIsOpen(false);
  };

  // 오늘 날짜
  const today = new Date();
  const isToday = (day: number) => {
    return (
      today.getFullYear() === currentYear &&
      today.getMonth() + 1 === currentMonth &&
      today.getDate() === day
    );
  };

  // 선택된 날짜인지 확인
  const isSelected = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return selectedDate === dateStr;
  };

  // 요일 헤더
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  // 선택된 날짜 포맷
  const formatSelectedDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={selectedDate ? 'default' : 'outline'}
            size="sm"
            className="text-xs gap-1 whitespace-nowrap"
          >
            <CalendarIcon className="w-4 h-4" />
            {selectedDate ? formatSelectedDate(selectedDate) : buttonText}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPrevMonth}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-medium text-sm">
                {currentYear}년 {currentMonth}월
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextMonth}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map((day, index) => (
                <div
                  key={day}
                  className={cn(
                    'text-center text-xs font-medium py-1',
                    index === 0 && 'text-red-500',
                    index === 6 && 'text-blue-500'
                  )}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {/* 빈 셀 (첫 번째 날까지) */}
                {Array.from({ length: firstDay }).map((_, index) => (
                  <div key={`empty-${index}`} className="h-12" />
                ))}

                {/* 날짜 셀 */}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayData = countMap.get(dateStr);
                  const hasData = dayData && dayData.total > 0;
                  const dayOfWeek = (firstDay + index) % 7;

                  return (
                    <button
                      key={day}
                      onClick={() => handleDateClick(day)}
                      className={cn(
                        'h-12 w-10 flex flex-col items-center justify-center rounded-md text-sm transition-colors relative',
                        'hover:bg-gray-100',
                        isToday(day) && 'ring-1 ring-blue-500',
                        isSelected(day) && 'bg-blue-600 text-white hover:bg-blue-700',
                        dayOfWeek === 0 && !isSelected(day) && 'text-red-500',
                        dayOfWeek === 6 && !isSelected(day) && 'text-blue-500'
                      )}
                    >
                      <span className="text-xs">{day}</span>
                      {hasData && (
                        <Badge
                          variant={isSelected(day) ? 'secondary' : 'default'}
                          className={cn(
                            'text-[10px] px-1 py-0 h-4 min-w-[20px] justify-center',
                            isSelected(day) ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                          )}
                        >
                          {dayData.total}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 선택된 날짜의 상세 정보 */}
            {selectedDate && countMap.get(selectedDate) && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium mb-2">
                  {formatSelectedDate(selectedDate)} 등록 상세
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {countMap.get(selectedDate)!.byUser.map((user) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between text-xs bg-gray-50 px-2 py-1 rounded"
                    >
                      <span>{user.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {user.count}명
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 총 등록 수 */}
            <div className="mt-3 pt-3 border-t text-center">
              <p className="text-xs text-gray-500">
                {currentMonth}월 총 등록: {' '}
                <span className="font-bold text-blue-600">
                  {dailyCounts.reduce((sum, d) => sum + d.total, 0)}명
                </span>
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* 선택된 날짜 표시 및 초기화 버튼 */}
      {selectedDate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDateSelect(null)}
          className="h-7 w-7 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
