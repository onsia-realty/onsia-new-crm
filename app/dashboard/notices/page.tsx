'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pin, AlertCircle, Info, Calendar, Megaphone, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSession } from 'next-auth/react';

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
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'GENERAL',
    isPinned: false
  });
  const { toast } = useToast();
  const { data: session } = useSession();

  const handleNew = () => {
    setEditingNotice(null);
    setFormData({
      title: '',
      content: '',
      category: 'GENERAL',
      isPinned: false
    });
    setEditDialogOpen(true);
  };

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

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setFormData({
      title: notice.title,
      content: notice.content,
      category: notice.category,
      isPinned: notice.isPinned
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      // 필수 필드 검증
      if (!formData.title || !formData.content) {
        toast({
          title: '입력 오류',
          description: '제목과 내용을 모두 입력해주세요.',
          variant: 'destructive'
        });
        return;
      }

      if (editingNotice) {
        // 수정
        const response = await fetch('/api/notices', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingNotice.id,
            ...formData
          })
        });

        const data = await response.json();

        if (response.ok) {
          toast({ title: '성공', description: '공지사항이 수정되었습니다.' });
          setEditDialogOpen(false);
          fetchNotices();
        } else {
          console.error('Update failed:', data);
          throw new Error(data.error || 'Failed to update notice');
        }
      } else {
        // 신규 작성
        const response = await fetch('/api/notices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
          toast({ title: '성공', description: '공지사항이 작성되었습니다.' });
          setEditDialogOpen(false);
          fetchNotices();
        } else {
          console.error('Create failed:', data);
          throw new Error(data.error || 'Failed to create notice');
        }
      }
    } catch (error) {
      console.error('Failed to save notice:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      toast({
        title: '오류',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/notices?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({ title: '성공', description: '공지사항이 삭제되었습니다.' });
        fetchNotices();
      } else {
        throw new Error('Failed to delete notice');
      }
    } catch (error) {
      console.error('Failed to delete notice:', error);
      toast({ title: '오류', description: '공지사항 삭제에 실패했습니다.', variant: 'destructive' });
    }
  };

  // 권한 체크: 관리자, 본부장, 팀장만 작성/수정/삭제 가능
  const canWrite = session?.user?.role && ['ADMIN', 'HEAD', 'TEAM_LEADER', 'CEO'].includes(session.user.role);
  const canEdit = canWrite;
  const canDelete = session?.user?.role && ['ADMIN', 'HEAD', 'CEO'].includes(session.user.role);

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
        {canWrite && (
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" /> 공지 작성
          </Button>
        )}
      </div>

      {/* 고정된 공지사항 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Pin className="h-5 w-5" /> 고정된 공지
        </h2>
        {notices.filter((notice) => notice.isPinned).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Pin className="h-8 w-8 mb-2 opacity-50" />
              <p>고정된 공지사항이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {notices
            .filter((notice) => notice.isPinned)
            .map((notice) => (
              <Card
                key={notice.id}
                className="border-2 border-primary/20 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => router.push(`/dashboard/notices/${notice.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getCategoryIcon(notice.category)}
                        {notice.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {notice.content}
                      </CardDescription>
                    </div>
                    <Badge className={getCategoryColor(notice.category)}>
                      {getCategoryLabel(notice.category)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>작성자: 관리자</span>
                    <span>{new Date(notice.createdAt).toLocaleString('ko-KR')}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
        )}
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
            {notices.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">등록된 공지사항이 없습니다.</p>
                  <p className="text-sm mt-1">새로운 공지사항이 등록되면 여기에 표시됩니다.</p>
                </CardContent>
              </Card>
            ) : notices.map((notice) => (
              <Card
                key={notice.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => router.push(`/dashboard/notices/${notice.id}`)}
              >
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
                      <CardDescription className="line-clamp-2">
                        {notice.content}
                      </CardDescription>
                    </div>
                    <Badge className={getCategoryColor(notice.category)}>
                      {getCategoryLabel(notice.category)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>작성자: 관리자</span>
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
                <Card
                  key={notice.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => router.push(`/dashboard/notices/${notice.id}`)}
                >
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
                        <CardDescription className="line-clamp-2">
                          {notice.content}
                        </CardDescription>
                      </div>
                      <Badge className={getCategoryColor(notice.category)}>
                        {getCategoryLabel(notice.category)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>작성자: 관리자</span>
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
                <Card
                  key={notice.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => router.push(`/dashboard/notices/${notice.id}`)}
                >
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
                        <CardDescription className="line-clamp-2">
                          {notice.content}
                        </CardDescription>
                      </div>
                      <Badge className={getCategoryColor(notice.category)}>
                        {getCategoryLabel(notice.category)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>작성자: 관리자</span>
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
                <Card
                  key={notice.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => router.push(`/dashboard/notices/${notice.id}`)}
                >
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
                        <CardDescription className="line-clamp-2">
                          {notice.content}
                        </CardDescription>
                      </div>
                      <Badge className={getCategoryColor(notice.category)}>
                        {getCategoryLabel(notice.category)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>작성자: 관리자</span>
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
                <Card
                  key={notice.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => router.push(`/dashboard/notices/${notice.id}`)}
                >
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
                        <CardDescription className="line-clamp-2">
                          {notice.content}
                        </CardDescription>
                      </div>
                      <Badge className={getCategoryColor(notice.category)}>
                        {getCategoryLabel(notice.category)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>작성자: 관리자</span>
                      <span>{new Date(notice.createdAt).toLocaleString('ko-KR')}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* 작성/수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingNotice ? '공지사항 수정' : '공지사항 작성'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>제목</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="공지사항 제목"
              />
            </div>
            <div>
              <Label>카테고리</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="URGENT">긴급</SelectItem>
                  <SelectItem value="SYSTEM">시스템</SelectItem>
                  <SelectItem value="EVENT">행사</SelectItem>
                  <SelectItem value="GENERAL">일반</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>내용</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="공지사항 내용 (마크다운 지원)"
                rows={10}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.isPinned}
                onCheckedChange={(checked) => setFormData({ ...formData, isPinned: checked as boolean })}
              />
              <Label>상단 고정</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}