'use client';

import { useState } from 'react';
import { Plus, Calendar, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SchedulesPage() {
  const [view, setView] = useState('list');

  // 임시 데이터
  const schedules = [
    {
      id: '1',
      customerName: '김철수',
      visitDate: '2024-01-20',
      visitTime: '14:00',
      visitType: '매물 방문',
      location: '강남구 삼성동 래미안',
      status: 'SCHEDULED',
      assignedTo: '박영업',
    },
    {
      id: '2',
      customerName: '이영희',
      visitDate: '2024-01-21',
      visitTime: '10:00',
      visitType: '계약 미팅',
      location: '송파구 사무실',
      status: 'SCHEDULED',
      assignedTo: '김매니저',
    },
    {
      id: '3',
      customerName: '박민수',
      visitDate: '2024-01-19',
      visitTime: '15:30',
      visitType: '상담',
      location: '서초구 사무실',
      status: 'COMPLETED',
      assignedTo: '이상담',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'NO_SHOW':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case '매물 방문':
        return 'bg-purple-100 text-purple-800';
      case '계약 미팅':
        return 'bg-orange-100 text-orange-800';
      case '상담':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">방문 일정</h1>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" /> 캘린더 보기
          </Button>
          <Button>
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
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">3개 완료, 2개 예정</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 주 일정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">월요일부터 일요일까지</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 달 완료율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <p className="text-xs text-muted-foreground">45개 중 39개 완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">노쇼율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3%</div>
            <p className="text-xs text-muted-foreground">전월 대비 -2%</p>
          </CardContent>
        </Card>
      </div>

      {/* 일정 목록 */}
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
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{schedule.customerName}</h3>
                          <Badge className={getTypeColor(schedule.visitType)}>
                            {schedule.visitType}
                          </Badge>
                          <Badge className={getStatusColor(schedule.status)}>
                            예정됨
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>📅 {schedule.visitDate} {schedule.visitTime}</p>
                          <p>📍 {schedule.location}</p>
                          <p>👤 담당: {schedule.assignedTo}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">수정</Button>
                        <Button size="sm">완료 처리</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
        <TabsContent value="today" className="space-y-4">
          <p className="text-muted-foreground">오늘 일정이 표시됩니다.</p>
        </TabsContent>
        <TabsContent value="completed" className="space-y-4">
          <div className="space-y-4">
            {schedules
              .filter((s) => s.status === 'COMPLETED')
              .map((schedule) => (
                <Card key={schedule.id} className="opacity-75">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{schedule.customerName}</h3>
                          <Badge className={getTypeColor(schedule.visitType)}>
                            {schedule.visitType}
                          </Badge>
                          <Badge className={getStatusColor(schedule.status)}>
                            완료됨
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>📅 {schedule.visitDate} {schedule.visitTime}</p>
                          <p>📍 {schedule.location}</p>
                          <p>👤 담당: {schedule.assignedTo}</p>
                        </div>
                      </div>
                    </div>
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
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{schedule.customerName}</h3>
                        <Badge className={getTypeColor(schedule.visitType)}>
                          {schedule.visitType}
                        </Badge>
                        <Badge className={getStatusColor(schedule.status)}>
                          {schedule.status === 'SCHEDULED' ? '예정됨' : '완료됨'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>📅 {schedule.visitDate} {schedule.visitTime}</p>
                        <p>📍 {schedule.location}</p>
                        <p>👤 담당: {schedule.assignedTo}</p>
                      </div>
                    </div>
                    {schedule.status === 'SCHEDULED' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">수정</Button>
                        <Button size="sm">완료 처리</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}