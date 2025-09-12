'use client';

import { useState } from 'react';
import { Plus, Pin, AlertCircle, Info, Calendar, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function NoticesPage() {
  // 임시 데이터
  const notices = [
    {
      id: '1',
      title: '1월 영업 목표 및 인센티브 정책 안내',
      content: '2024년 1월 영업 목표가 설정되었습니다. 자세한 인센티브 정책은 첨부 파일을 확인해주세요.',
      category: 'URGENT',
      isPinned: true,
      author: '관리자',
      createdAt: '2024-01-15 09:00',
    },
    {
      id: '2',
      title: '신규 고객 관리 시스템 업데이트',
      content: 'CRM 시스템이 업데이트되었습니다. 새로운 기능과 개선사항을 확인해주세요.',
      category: 'SYSTEM',
      isPinned: true,
      author: '시스템',
      createdAt: '2024-01-14 15:30',
    },
    {
      id: '3',
      title: '2월 정기 교육 일정 안내',
      content: '2월 둘째 주 화요일에 부동산 트렌드 교육이 예정되어 있습니다.',
      category: 'EVENT',
      isPinned: false,
      author: '교육팀',
      createdAt: '2024-01-13 14:00',
    },
    {
      id: '4',
      title: '주차장 이용 안내',
      content: '건물 주차장 공사로 인해 1월 20일부터 25일까지 주차 공간이 제한됩니다.',
      category: 'GENERAL',
      isPinned: false,
      author: '총무팀',
      createdAt: '2024-01-12 11:00',
    },
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'URGENT':
        return <AlertCircle className="h-4 w-4" />;
      case 'SYSTEM':
        return <Info className="h-4 w-4" />;
      case 'EVENT':
        return <Calendar className="h-4 w-4" />;
      case 'GENERAL':
        return <Megaphone className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'URGENT':
        return 'bg-red-100 text-red-800';
      case 'SYSTEM':
        return 'bg-blue-100 text-blue-800';
      case 'EVENT':
        return 'bg-purple-100 text-purple-800';
      case 'GENERAL':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'URGENT':
        return '긴급';
      case 'SYSTEM':
        return '시스템';
      case 'EVENT':
        return '행사';
      case 'GENERAL':
        return '일반';
      default:
        return category;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">공지사항</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> 공지 작성
        </Button>
      </div>

      {/* 고정된 공지사항 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Pin className="h-5 w-5" /> 고정된 공지
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {notices
            .filter((notice) => notice.isPinned)
            .map((notice) => (
              <Card key={notice.id} className="border-2 border-primary/20">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getCategoryIcon(notice.category)}
                        {notice.title}
                      </CardTitle>
                      <CardDescription>{notice.content}</CardDescription>
                    </div>
                    <Badge className={getCategoryColor(notice.category)}>
                      {getCategoryLabel(notice.category)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>작성자: {notice.author}</span>
                    <span>{notice.createdAt}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {/* 카테고리별 공지사항 */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="urgent">긴급</TabsTrigger>
          <TabsTrigger value="system">시스템</TabsTrigger>
          <TabsTrigger value="event">행사</TabsTrigger>
          <TabsTrigger value="general">일반</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-4">
          <div className="space-y-4">
            {notices.map((notice) => (
              <Card key={notice.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getCategoryIcon(notice.category)}
                        {notice.title}
                        {notice.isPinned && (
                          <Pin className="h-4 w-4 text-primary" />
                        )}
                      </CardTitle>
                      <CardDescription>{notice.content}</CardDescription>
                    </div>
                    <Badge className={getCategoryColor(notice.category)}>
                      {getCategoryLabel(notice.category)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>작성자: {notice.author}</span>
                    <span>{notice.createdAt}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="urgent" className="space-y-4">
          <div className="space-y-4">
            {notices
              .filter((n) => n.category === 'URGENT')
              .map((notice) => (
                <Card key={notice.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {getCategoryIcon(notice.category)}
                          {notice.title}
                          {notice.isPinned && (
                            <Pin className="h-4 w-4 text-primary" />
                          )}
                        </CardTitle>
                        <CardDescription>{notice.content}</CardDescription>
                      </div>
                      <Badge className={getCategoryColor(notice.category)}>
                        {getCategoryLabel(notice.category)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>작성자: {notice.author}</span>
                      <span>{notice.createdAt}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
        <TabsContent value="system" className="space-y-4">
          <div className="space-y-4">
            {notices
              .filter((n) => n.category === 'SYSTEM')
              .map((notice) => (
                <Card key={notice.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {getCategoryIcon(notice.category)}
                          {notice.title}
                          {notice.isPinned && (
                            <Pin className="h-4 w-4 text-primary" />
                          )}
                        </CardTitle>
                        <CardDescription>{notice.content}</CardDescription>
                      </div>
                      <Badge className={getCategoryColor(notice.category)}>
                        {getCategoryLabel(notice.category)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>작성자: {notice.author}</span>
                      <span>{notice.createdAt}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
        <TabsContent value="event" className="space-y-4">
          <div className="space-y-4">
            {notices
              .filter((n) => n.category === 'EVENT')
              .map((notice) => (
                <Card key={notice.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {getCategoryIcon(notice.category)}
                          {notice.title}
                          {notice.isPinned && (
                            <Pin className="h-4 w-4 text-primary" />
                          )}
                        </CardTitle>
                        <CardDescription>{notice.content}</CardDescription>
                      </div>
                      <Badge className={getCategoryColor(notice.category)}>
                        {getCategoryLabel(notice.category)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>작성자: {notice.author}</span>
                      <span>{notice.createdAt}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
        <TabsContent value="general" className="space-y-4">
          <div className="space-y-4">
            {notices
              .filter((n) => n.category === 'GENERAL')
              .map((notice) => (
                <Card key={notice.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {getCategoryIcon(notice.category)}
                          {notice.title}
                          {notice.isPinned && (
                            <Pin className="h-4 w-4 text-primary" />
                          )}
                        </CardTitle>
                        <CardDescription>{notice.content}</CardDescription>
                      </div>
                      <Badge className={getCategoryColor(notice.category)}>
                        {getCategoryLabel(notice.category)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>작성자: {notice.author}</span>
                      <span>{notice.createdAt}</span>
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