'use client';

import { useEffect, useState } from 'react';
import { Plus, Pin, AlertCircle, Info, Calendar, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Notice {
  id: string;
  title: string;
  content: string;
  category: string;
  isPinned: boolean;
  author: { name: string };
  createdAt: string;
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      const response = await fetch('/api/notices');
      if (response.ok) {
        const data = await response.json();
        setNotices(data.notices || []);
      }
    } catch (error) {
      console.error('Failed to fetch notices:', error);
    }
  };

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
                    <span>작성자: {notice.author.name}</span>
                    <span>{new Date(notice.createdAt).toLocaleString('ko-KR')}</span>
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
                    <span>작성자: {notice.author.name}</span>
                    <span>{new Date(notice.createdAt).toLocaleString('ko-KR')}</span>
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
                      <span>작성자: {notice.author.name}</span>
                      <span>{new Date(notice.createdAt).toLocaleString('ko-KR')}</span>
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
                      <span>작성자: {notice.author.name}</span>
                      <span>{new Date(notice.createdAt).toLocaleString('ko-KR')}</span>
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
                      <span>작성자: {notice.author.name}</span>
                      <span>{new Date(notice.createdAt).toLocaleString('ko-KR')}</span>
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
                      <span>작성자: {notice.author.name}</span>
                      <span>{new Date(notice.createdAt).toLocaleString('ko-KR')}</span>
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