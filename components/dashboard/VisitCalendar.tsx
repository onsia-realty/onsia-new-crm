'use client';

import { useEffect, useState } from 'react';
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
  date: string;
  status: 'SCHEDULED' | 'CHECKED' | 'NO_SHOW';
  note?: string;
}

export default function VisitCalendar() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVisits();
  }, []);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/visit-schedules');
      const result = await response.json();

      if (result.success && result.data) {
        const calendarEvents = result.data.map((visit: VisitEvent) => ({
          id: visit.id,
          title: `${visit.customerName || '고객'}`,
          start: visit.date,
          backgroundColor: getStatusColor(visit.status),
          borderColor: getStatusColor(visit.status),
          extendedProps: {
            customerId: visit.customerId,
            status: visit.status,
            note: visit.note,
          }
        }));
        setEvents(calendarEvents);
      }
    } catch (error) {
      console.error('Error fetching visits:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleEventClick = (info: any) => {
    const customerId = info.event.extendedProps.customerId;
    if (customerId) {
      router.push(`/dashboard/customers/${customerId}`);
    }
  };

  const handleDateClick = (info: any) => {
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
        eventDisplay="block"
        dayMaxEvents={3}
        moreLinkText="개 더보기"
        buttonText={{
          today: '오늘',
          month: '월',
          week: '주',
        }}
        dayCellClassNames="hover:bg-gray-50 cursor-pointer"
        eventClassNames="cursor-pointer hover:opacity-80"
      />
    </div>
  );
}
