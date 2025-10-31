'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

// FullCalendar를 동적으로 로드 (SSR 비활성화)
const FullCalendar = dynamic(() => import('@fullcalendar/react'), { ssr: false });
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';

interface VisitEvent {
  id: string;
  customerId: string;
  customerName: string;
  userName: string;
  date: string;
  status: 'SCHEDULED' | 'CHECKED' | 'NO_SHOW';
  note?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  backgroundColor: string;
  extendedProps: {
    customerId: string;
    status: string;
  };
}

export default function VisitCalendar() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CHECKED':
        return '#10b981'; // green
      case 'NO_SHOW':
        return '#ef4444'; // red
      default:
        return '#3b82f6'; // blue
    }
  };

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
        const calendarEvents = result.data.map((visit: any) => ({
          id: visit.id,
          title: '', // Don't show title - we'll show employee counts instead
          start: visit.visitDate || visit.date,
          display: 'none', // Hide the event dots
          backgroundColor: getStatusColor(visit.status),
          borderColor: getStatusColor(visit.status),
          extendedProps: {
            customerId: visit.customerId,
            userName: visit.user?.name || visit.userName || '직원',
            status: visit.status,
            note: visit.note,
          }
        }));
        setEvents(calendarEvents);
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
    const counts: { [dateKey: string]: { [userName: string]: number } } = {};
    events.forEach(event => {
      if (event.start) {
        const date = new Date(event.start);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        const userName = event.extendedProps?.userName || '직원';
        
        if (!counts[dateKey]) {
          counts[dateKey] = {};
        }
        counts[dateKey][userName] = (counts[dateKey][userName] || 0) + 1;
      }
    });
    return counts;
  }, [events]);

  const handleEventClick = async (info: { event: { id: string, extendedProps: { customerId?: string, status?: string } } }) => {
    const visitId = info.event.id;
    const currentStatus = info.event.extendedProps.status;

    // 상태 토글: SCHEDULED <-> CHECKED
    const newStatus = currentStatus === 'CHECKED' ? 'SCHEDULED' : 'CHECKED';

    try {
      const response = await fetch(`/api/visit-schedules/${visitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        // 성공 시 일정 다시 조회
        fetchVisits();
      } else {
        console.error('Failed to update visit status');
      }
    } catch (error) {
      console.error('Error updating visit status:', error);
    }
  };

  const handleDateClick = (info: { dateStr: string }) => {
    router.push(`/dashboard/schedules?date=${info.dateStr}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={koLocale}
        events={events}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek'
        }}
        height="auto"
        eventDisplay="none"
        dayMaxEvents={false}
        moreLinkText="개 더보기"
        buttonText={{
          today: '오늘',
          month: '월',
          week: '주',
        }}
        dayCellClassNames="hover:bg-gray-50 cursor-pointer"
        eventClassNames="cursor-pointer hover:opacity-80"
        dayCellContent={(arg) => {
          const date = arg.date;
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const dateKey = `${year}-${month}-${day}`;
          const userCounts = dailyUserCounts[dateKey] || {};
          const entries = Object.entries(userCounts);
          
          return (
            <div className="relative w-full h-full p-1">
              <div className="fc-daygrid-day-number text-sm font-semibold">{arg.dayNumberText}</div>
              {entries.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {entries.map(([name, count]) => (
                    <div key={name} className="text-xs leading-tight truncate">
                      <span className="text-blue-600 font-medium">{name}</span>
                      <span className="text-red-600 font-bold"> +{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}