'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Calendar as CalendarIcon, List, User, Phone, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import AddScheduleDialog from '@/components/schedules/AddScheduleDialog';

interface VisitSchedule {
  id: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  userId: string;
  user: {
    id: string;
    name: string;
  };
  visitDate: string;
  visitType: string;
  status: string;
  note?: string;
}

export default function SchedulesPage() {
  const { data: session } = useSession();
  const [view, setView] = useState('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [schedules, setSchedules] = useState<VisitSchedule[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'HEAD';

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/visit-schedules');
      if (response.ok) {
        const result = await response.json();
        const scheduleData = result.data || result.schedules || [];
        console.log('[Schedules Debug] Total schedules:', scheduleData.length);
        console.log('[Schedules Debug] First schedule:', scheduleData[0]);
        setSchedules(scheduleData);
      }
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    }
  };

  const handleStatusChange = async (scheduleId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/visit-schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchSchedules();
      } else {
        alert('상태 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('Status update error:', error);
      alert('오류가 발생했습니다.');
    }
  };

  // Add employee visit counts to calendar cells
  useEffect(() => {
    if (schedules.length === 0) return;

    // Clear previous additions
    document.querySelectorAll('.employee-visits').forEach(el => el.remove());

    // Group schedules by date (using local date to avoid timezone issues)
    const schedulesByDate: { [key: string]: VisitSchedule[] } = {};
    schedules.forEach(schedule => {
      const date = new Date(schedule.visitDate);
      // Use local date string to avoid timezone conversion issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      
      if (!schedulesByDate[dateKey]) {
        schedulesByDate[dateKey] = [];
      }
      schedulesByDate[dateKey].push(schedule);
    });
    
    // Debug log
    console.log('[Calendar] Schedules by date:', schedulesByDate);

    // Add to calendar cells
    Object.entries(schedulesByDate).forEach(([dateKey, daySchedules]) => {
      // Try multiple selectors to find the date button
      const selectors = [
        `button[data-day="${dateKey}"]`,
        `button[aria-label*="${dateKey}"]`,
        `td[data-date="${dateKey}"] button`,
      ];
      
      let button = null;
      for (const selector of selectors) {
        button = document.querySelector(selector);
        if (button) break;
      }

      // If no button found, try to find by date text
      if (!button) {
        const date = new Date(dateKey);
        const day = date.getDate();
        const buttons = document.querySelectorAll('.rdp-day button');
        buttons.forEach(btn => {
          if (btn.textContent === String(day)) {
            // Check if this is the right month
            const monthEl = btn.closest('.rdp-month');
            if (monthEl) {
              const captionEl = monthEl.querySelector('.rdp-month_caption');
              if (captionEl && captionEl.textContent?.includes(String(date.getMonth() + 1))) {
                button = btn;
              }
            }
          }
        });
      }

      if (button && !button.querySelector('.employee-visits')) {
        // Group by employee
        const userCounts: { [key: string]: number } = {};
        daySchedules.forEach(schedule => {
          userCounts[schedule.user.name] = (userCounts[schedule.user.name] || 0) + 1;
        });
        
        console.log(`[Calendar] ${dateKey} user counts:`, userCounts, 'from schedules:', daySchedules.length);

        // Create info element
        const infoDiv = document.createElement('div');
        infoDiv.className = 'employee-visits';
        infoDiv.style.cssText = 'position: absolute; bottom: 2px; left: 2px; right: 2px; font-size: 9px; color: #2563eb; text-align: center; pointer-events: none;';

        Object.entries(userCounts).forEach(([name, count]) => {
          const span = document.createElement('div');
          span.textContent = `${name} +${count}`;
          span.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.1;';
          infoDiv.appendChild(span);
        });

        // Make button relative positioned
        (button as HTMLElement).style.position = 'relative';
        button.appendChild(infoDiv);
      }
    });
  }, [schedules]);

  // 선택된 날짜의 일정
  const getSchedulesForDate = (date: Date) => {
    return schedules.filter(s => {
      const visitDate = new Date(s.visitDate);
      return visitDate.toDateString() === date.toDateString();
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800';
      case 'CHECKED':
        return 'bg-green-100 text-green-800';
      case 'NO_SHOW':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return '예정';
      case 'CHECKED':
        return '완료';
      case 'NO_SHOW':
        return '노쇼';
      default:
        return status;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CONSULTATION':
        return 'bg-purple-100 text-purple-800';
      case 'CONTRACT':
        return 'bg-orange-100 text-orange-800';
      case 'SITE_VISIT':
        return 'bg-indigo-100 text-indigo-800';
      case 'FOLLOW_UP':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'CONSULTATION':
        return '상담';
      case 'CONTRACT':
        return '계약';
      case 'SITE_VISIT':
        return '현장방문';
      case 'FOLLOW_UP':
        return '후속관리';
      default:
        return type;
    }
  };

  // 커스텀 DayContent 컴포넌트

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">방문 일정</h1>
        <div className="flex gap-2">
          <Button
            variant={view === 'calendar' ? 'default' : 'outline'}
            onClick={() => setView('calendar')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" /> 캘린더 보기
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            onClick={() => setView('list')}
          >
            <List className="mr-2 h-4 w-4" /> 목록 보기
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> 일정 추가
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 일정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.filter(s => {
                const visitDate = new Date(s.visitDate);
                const today = new Date();
                return visitDate.toDateString() === today.toDateString();
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {schedules.filter(s => {
                const visitDate = new Date(s.visitDate);
                const today = new Date();
                return visitDate.toDateString() === today.toDateString() && s.status === 'CHECKED';
              }).length}개 완료
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 주 일정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.length}</div>
            <p className="text-xs text-muted-foreground">전체 방문 일정</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 달 완료율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.length > 0
                ? Math.round((schedules.filter(s => s.status === 'CHECKED').length / schedules.length) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {schedules.length}개 중 {schedules.filter(s => s.status === 'CHECKED').length}개 완료
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">노쇼율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.length > 0
                ? Math.round((schedules.filter(s => s.status === 'NO_SHOW').length / schedules.length) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {schedules.filter(s => s.status === 'NO_SHOW').length}건 노쇼
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 캘린더 뷰 */}
      {view === 'calendar' && (
        <Card>
          <CardHeader>
            <CardTitle>월간 일정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 캘린더 */}
              <div className="lg:col-span-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={ko}
                  className="rounded-md border w-full"
                />
              </div>

              {/* 선택된 날짜의 일정 */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">
                  {selectedDate
                    ? format(selectedDate, 'M월 d일 일정', { locale: ko })
                    : '날짜를 선택하세요'}
                </h3>
                <div className="space-y-3">
                  {selectedDate && getSchedulesForDate(selectedDate).length > 0 ? (
                    getSchedulesForDate(selectedDate).map(schedule => (
                      <Card
                        key={schedule.id}
                        className={cn(
                          "transition-all",
                          isAdmin ? "hover:shadow-md cursor-pointer" : "cursor-default"
                        )}
                      >
                        <CardContent className="p-4">
                          {isAdmin ? (
                            <Link href={`/dashboard/customers/${schedule.customerId}`}>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-gray-500" />
                                    <span className="font-medium">{schedule.customer.name}</span>
                                  </div>
                                  <Badge className={getStatusColor(schedule.status)} variant="secondary">
                                    {getStatusText(schedule.status)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Phone className="w-3 h-3" />
                                  <span>{schedule.customer.phone}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={getTypeColor(schedule.visitType)}>
                                    {getTypeText(schedule.visitType)}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    담당: {schedule.user.name}
                                  </span>
                                </div>
                                {schedule.note && (
                                  <p className="text-sm text-muted-foreground mt-2">
                                    {schedule.note}
                                  </p>
                                )}
                                <p className="text-xs text-blue-600 mt-2">
                                  클릭하여 고객 상세 보기 →
                                </p>
                                <div className="flex gap-2 mt-3 pt-3 border-t" onClick={(e) => e.preventDefault()}>
                                  <Button
                                    size="sm"
                                    variant={schedule.status === 'CHECKED' ? 'default' : 'outline'}
                                    className="flex-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleStatusChange(schedule.id, 'CHECKED');
                                    }}
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    방문 완료
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={schedule.status === 'NO_SHOW' ? 'destructive' : 'outline'}
                                    className="flex-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleStatusChange(schedule.id, 'NO_SHOW');
                                    }}
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />
                                    노쇼
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={schedule.status === 'RESCHEDULED' ? 'secondary' : 'outline'}
                                    className="flex-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleStatusChange(schedule.id, 'RESCHEDULED');
                                    }}
                                  >
                                    <Clock className="w-3 h-3 mr-1" />
                                    일정 변경
                                  </Button>
                                </div>
                              </div>
                            </Link>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-gray-500" />
                                  <span className="font-medium">{schedule.customer.name}</span>
                                </div>
                                <Badge className={getStatusColor(schedule.status)} variant="secondary">
                                  {getStatusText(schedule.status)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="w-3 h-3" />
                                <span>{schedule.customer.phone}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getTypeColor(schedule.visitType)}>
                                  {getTypeText(schedule.visitType)}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  담당: {schedule.user.name}
                                </span>
                              </div>
                              {schedule.note && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  {schedule.note}
                                </p>
                              )}
                              <div className="flex gap-2 mt-3 pt-3 border-t">
                                <Button
                                  size="sm"
                                  variant={schedule.status === 'CHECKED' ? 'default' : 'outline'}
                                  className="flex-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleStatusChange(schedule.id, 'CHECKED');
                                  }}
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  방문 완료
                                </Button>
                                <Button
                                  size="sm"
                                  variant={schedule.status === 'NO_SHOW' ? 'destructive' : 'outline'}
                                  className="flex-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleStatusChange(schedule.id, 'NO_SHOW');
                                  }}
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  노쇼
                                </Button>
                                <Button
                                  size="sm"
                                  variant={schedule.status === 'RESCHEDULED' ? 'secondary' : 'outline'}
                                  className="flex-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleStatusChange(schedule.id, 'RESCHEDULED');
                                  }}
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  일정 변경
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  ) : selectedDate ? (
                    <p className="text-center text-muted-foreground py-8">
                      이 날짜에 일정이 없습니다.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 일정 추가 다이얼로그 */}
      <AddScheduleDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={fetchSchedules}
        preselectedDate={selectedDate}
      />

      {/* 일정 목록 */}
      {view === 'list' && (
        <Tabs defaultValue="upcoming" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upcoming">예정된 일정</TabsTrigger>
            <TabsTrigger value="today">오늘</TabsTrigger>
            <TabsTrigger value="completed">완료됨</TabsTrigger>
            <TabsTrigger value="all">전체</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="space-y-4">
            <div className="space-y-4">
              {schedules
                .filter((s) => s.status === 'SCHEDULED')
                .map((schedule) => (
                  <Card key={schedule.id}>
                    <CardContent className="p-6">
                      {isAdmin ? (
                        <Link href={`/dashboard/customers/${schedule.customerId}`}>
                          <div className="flex justify-between items-start hover:bg-gray-50 rounded p-2 -m-2 transition">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">{schedule.customer.name}</h3>
                                <Badge className={getTypeColor(schedule.visitType)}>
                                  {getTypeText(schedule.visitType)}
                                </Badge>
                                <Badge className={getStatusColor(schedule.status)}>
                                  {getStatusText(schedule.status)}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>📅 {format(new Date(schedule.visitDate), 'PPP', { locale: ko })}</p>
                                <p>📞 {schedule.customer.phone}</p>
                                <p>👤 담당: {schedule.user.name}</p>
                                {schedule.note && <p>📝 {schedule.note}</p>}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{schedule.customer.name}</h3>
                              <Badge className={getTypeColor(schedule.visitType)}>
                                {getTypeText(schedule.visitType)}
                              </Badge>
                              <Badge className={getStatusColor(schedule.status)}>
                                {getStatusText(schedule.status)}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>📅 {format(new Date(schedule.visitDate), 'PPP', { locale: ko })}</p>
                              <p>📞 {schedule.customer.phone}</p>
                              <p>👤 담당: {schedule.user.name}</p>
                              {schedule.note && <p>📝 {schedule.note}</p>}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              {schedules.filter((s) => s.status === 'SCHEDULED').length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  예정된 일정이 없습니다.
                </p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="today" className="space-y-4">
            <div className="space-y-4">
              {schedules
                .filter(s => {
                  const visitDate = new Date(s.visitDate);
                  const today = new Date();
                  return visitDate.toDateString() === today.toDateString();
                })
                .map((schedule) => (
                  <Card key={schedule.id}>
                    <CardContent className="p-6">
                      {isAdmin ? (
                        <Link href={`/dashboard/customers/${schedule.customerId}`}>
                          <div className="space-y-2 hover:bg-gray-50 rounded p-2 -m-2 transition">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{schedule.customer.name}</h3>
                              <Badge className={getTypeColor(schedule.visitType)}>
                                {getTypeText(schedule.visitType)}
                              </Badge>
                              <Badge className={getStatusColor(schedule.status)}>
                                {getStatusText(schedule.status)}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>📞 {schedule.customer.phone}</p>
                              <p>👤 담당: {schedule.user.name}</p>
                              {schedule.note && <p>📝 {schedule.note}</p>}
                            </div>
                          </div>
                        </Link>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{schedule.customer.name}</h3>
                            <Badge className={getTypeColor(schedule.visitType)}>
                              {getTypeText(schedule.visitType)}
                            </Badge>
                            <Badge className={getStatusColor(schedule.status)}>
                              {getStatusText(schedule.status)}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>📞 {schedule.customer.phone}</p>
                            <p>👤 담당: {schedule.user.name}</p>
                            {schedule.note && <p>📝 {schedule.note}</p>}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
          <TabsContent value="completed" className="space-y-4">
            <div className="space-y-4">
              {schedules
                .filter((s) => s.status === 'CHECKED')
                .map((schedule) => (
                  <Card key={schedule.id} className="opacity-75">
                    <CardContent className="p-6">
                      {isAdmin ? (
                        <Link href={`/dashboard/customers/${schedule.customerId}`}>
                          <div className="space-y-2 hover:bg-gray-50 rounded p-2 -m-2 transition">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{schedule.customer.name}</h3>
                              <Badge className={getTypeColor(schedule.visitType)}>
                                {getTypeText(schedule.visitType)}
                              </Badge>
                              <Badge className={getStatusColor(schedule.status)}>
                                {getStatusText(schedule.status)}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>📅 {format(new Date(schedule.visitDate), 'PPP', { locale: ko })}</p>
                              <p>📞 {schedule.customer.phone}</p>
                              <p>👤 담당: {schedule.user.name}</p>
                            </div>
                          </div>
                        </Link>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{schedule.customer.name}</h3>
                            <Badge className={getTypeColor(schedule.visitType)}>
                              {getTypeText(schedule.visitType)}
                            </Badge>
                            <Badge className={getStatusColor(schedule.status)}>
                              {getStatusText(schedule.status)}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>📅 {format(new Date(schedule.visitDate), 'PPP', { locale: ko })}</p>
                            <p>📞 {schedule.customer.phone}</p>
                            <p>👤 담당: {schedule.user.name}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
          <TabsContent value="all" className="space-y-4">
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <Card key={schedule.id}>
                  <CardContent className="p-6">
                    {isAdmin ? (
                      <Link href={`/dashboard/customers/${schedule.customerId}`}>
                        <div className="space-y-2 hover:bg-gray-50 rounded p-2 -m-2 transition">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{schedule.customer.name}</h3>
                            <Badge className={getTypeColor(schedule.visitType)}>
                              {getTypeText(schedule.visitType)}
                            </Badge>
                            <Badge className={getStatusColor(schedule.status)}>
                              {getStatusText(schedule.status)}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>📅 {format(new Date(schedule.visitDate), 'PPP', { locale: ko })}</p>
                            <p>📞 {schedule.customer.phone}</p>
                            <p>👤 담당: {schedule.user.name}</p>
                            {schedule.note && <p>📝 {schedule.note}</p>}
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{schedule.customer.name}</h3>
                          <Badge className={getTypeColor(schedule.visitType)}>
                            {getTypeText(schedule.visitType)}
                          </Badge>
                          <Badge className={getStatusColor(schedule.status)}>
                            {getStatusText(schedule.status)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>📅 {format(new Date(schedule.visitDate), 'PPP', { locale: ko })}</p>
                          <p>📞 {schedule.customer.phone}</p>
                          <p>👤 담당: {schedule.user.name}</p>
                          {schedule.note && <p>📝 {schedule.note}</p>}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
