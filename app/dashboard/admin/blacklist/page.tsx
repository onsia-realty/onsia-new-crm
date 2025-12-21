'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Ban, Plus, Trash2, AlertTriangle, Phone, User, Calendar, Users, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface BlacklistEntry {
  id: string;
  phone: string;
  name: string | null;
  reason: string;
  isActive: boolean;
  createdAt: string;
  registeredBy: {
    id: string;
    name: string;
  } | null;
}

function BlacklistPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // URL 파라미터에서 검색 상태 읽기
  const urlPhoneQuery = searchParams.get('phone') || '';
  const urlNameQuery = searchParams.get('name') || '';
  const urlViewMode = (searchParams.get('view') as 'mine' | 'all') || 'mine';
  const urlPage = parseInt(searchParams.get('page') || '1', 10);

  // 로컬 입력 상태 (URL과 별도로 관리)
  const [phoneInput, setPhoneInput] = useState(urlPhoneQuery);
  const [nameInput, setNameInput] = useState(urlNameQuery);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingLoading, setAddingLoading] = useState(false);
  const [newEntry, setNewEntry] = useState({ phone: '', name: '', reason: '' });

  const [pagination, setPagination] = useState({
    page: urlPage,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // 관리자 여부 확인
  const isAdmin = session?.user?.role && ['ADMIN', 'HEAD', 'TEAM_LEADER', 'CEO'].includes(session.user.role);

  // URL 파라미터 업데이트 함수
  const updateUrlParams = useCallback((updates: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' ||
          (key === 'page' && value === 1) ||
          (key === 'view' && value === 'mine')) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/dashboard/admin/blacklist${newUrl}`, { scroll: false });
  }, [router, searchParams]);

  // 권한 체크 - 모든 직원 접근 가능
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
  }, [session, status, router]);

  // URL 파라미터가 변경될 때 로컬 상태 동기화
  useEffect(() => {
    setPhoneInput(urlPhoneQuery);
    setNameInput(urlNameQuery);
    setPagination(prev => ({ ...prev, page: urlPage }));
  }, [urlPhoneQuery, urlNameQuery, urlPage]);

  const fetchBlacklist = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: urlPage.toString(),
        limit: pagination.limit.toString(),
        // viewMode가 'mine'이면 본인이 등록한 것만 조회, 'all'이면 전체 조회
        ...(urlViewMode === 'mine' && { registeredById: session.user.id }),
      });

      // 전화번호 검색
      if (urlPhoneQuery) {
        params.set('phone', urlPhoneQuery);
      }

      // 이름 검색
      if (urlNameQuery) {
        params.set('name', urlNameQuery);
      }

      const response = await fetch(`/api/blacklist?${params}`);
      const result = await response.json();

      if (result.success) {
        setBlacklist(result.data);
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch blacklist:', error);
      toast({
        title: '오류',
        description: '블랙리스트를 불러오는데 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [urlPage, pagination.limit, urlPhoneQuery, urlNameQuery, urlViewMode, toast, session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchBlacklist();
    }
  }, [fetchBlacklist, session?.user?.id]);

  // 검색 실행 (Enter 또는 버튼 클릭)
  const handleSearch = () => {
    updateUrlParams({
      phone: phoneInput || null,
      name: nameInput || null,
      page: 1
    });
  };

  // 검색 초기화
  const handleResetSearch = () => {
    setPhoneInput('');
    setNameInput('');
    updateUrlParams({
      phone: null,
      name: null,
      page: 1
    });
  };

  const handleAdd = async () => {
    if (!newEntry.phone || !newEntry.reason) {
      toast({
        title: '입력 오류',
        description: '전화번호와 사유는 필수입니다.',
        variant: 'destructive',
      });
      return;
    }

    setAddingLoading(true);
    try {
      const response = await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: '등록 완료',
          description: result.message || '블랙리스트에 등록되었습니다.',
        });
        setShowAddDialog(false);
        setNewEntry({ phone: '', name: '', reason: '' });
        fetchBlacklist();
      } else {
        toast({
          title: '등록 실패',
          description: result.error || '블랙리스트 등록에 실패했습니다.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to add blacklist:', error);
      toast({
        title: '오류',
        description: '블랙리스트 등록 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setAddingLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/blacklist/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: '해제 완료',
          description: '블랙리스트에서 해제되었습니다.',
        });
        setShowDeleteConfirm(false);
        setDeletingId(null);
        fetchBlacklist();
      } else {
        toast({
          title: '해제 실패',
          description: result.error || '블랙리스트 해제에 실패했습니다.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to delete blacklist:', error);
      toast({
        title: '오류',
        description: '블랙리스트 해제 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const formatPhone = (phone: string) => {
    if (phone.length === 11) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    }
    if (phone.length === 10) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
    }
    return phone;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // 탭 변경 시 페이지 초기화
  const handleViewModeChange = (value: string) => {
    updateUrlParams({ view: value === 'mine' ? null : value, page: 1 });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Ban className="w-8 h-8" />
            블랙리스트 관리
          </h1>
          <p className="text-muted-foreground mt-1">
            전화 금지 고객을 관리합니다. 블랙리스트에 등록된 고객은 상세 페이지에서 경고가 표시됩니다.
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          블랙리스트 추가
        </Button>
      </div>

      {/* 탭: 내 블랙리스트 / 전체 블랙리스트 */}
      <Tabs value={urlViewMode} onValueChange={handleViewModeChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="mine" className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            내 블랙리스트
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            전체 블랙리스트
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 검색 - 이름/전화번호 분리 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-2 md:gap-4">
            {/* 이름 검색 */}
            <div className="flex-1 relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="이름 검색 (Enter)"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            {/* 전화번호 검색 */}
            <div className="flex-1 relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="전화번호 검색 (Enter)"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            {/* 검색/초기화 버튼 */}
            <div className="flex gap-2">
              <Button onClick={handleSearch} variant="secondary">
                검색
              </Button>
              {(urlPhoneQuery || urlNameQuery) && (
                <Button onClick={handleResetSearch} variant="outline">
                  초기화
                </Button>
              )}
            </div>
          </div>
          {/* 현재 검색 조건 표시 */}
          {(urlPhoneQuery || urlNameQuery) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {urlNameQuery && (
                <Badge variant="secondary">이름: {urlNameQuery}</Badge>
              )}
              {urlPhoneQuery && (
                <Badge variant="secondary">전화번호: {urlPhoneQuery}</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 블랙리스트 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>
            {urlViewMode === 'mine' ? '내가 등록한 블랙리스트' : '전체 블랙리스트'} ({pagination.total}건)
          </CardTitle>
          <CardDescription>
            {urlViewMode === 'mine'
              ? '내가 등록한 블랙리스트 목록입니다.'
              : '모든 직원이 등록한 블랙리스트 목록입니다.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>전화번호</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>사유</TableHead>
                <TableHead>등록자</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blacklist.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    등록된 블랙리스트가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                blacklist.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        {formatPhone(entry.phone)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.name || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span className="text-sm">{entry.reason}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {entry.registeredBy?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date(entry.createdAt), 'yyyy-MM-dd', { locale: ko })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingId(entry.id);
                          setShowDeleteConfirm(true);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        해제
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateUrlParams({ page: urlPage - 1 })}
                disabled={urlPage === 1}
              >
                이전
              </Button>
              <span className="flex items-center px-3 text-sm">
                {urlPage} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateUrlParams({ page: urlPage + 1 })}
                disabled={urlPage === pagination.totalPages}
              >
                다음
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 블랙리스트 추가 다이얼로그 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>블랙리스트 추가</DialogTitle>
            <DialogDescription>
              전화 금지 고객을 등록합니다. 등록된 고객은 상세 페이지에서 경고가 표시됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">
                전화번호 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                placeholder="010-1234-5678"
                value={newEntry.phone}
                onChange={(e) => setNewEntry(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">이름 (선택)</Label>
              <Input
                id="name"
                placeholder="고객 이름"
                value={newEntry.name}
                onChange={(e) => setNewEntry(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">
                사유 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="블랙리스트 등록 사유를 입력하세요"
                value={newEntry.reason}
                onChange={(e) => setNewEntry(prev => ({ ...prev, reason: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              취소
            </Button>
            <Button onClick={handleAdd} disabled={addingLoading}>
              {addingLoading ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 해제 확인 다이얼로그 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>블랙리스트 해제</DialogTitle>
            <DialogDescription>
              정말로 이 고객을 블랙리스트에서 해제하시겠습니까?
              해제 후에도 다시 등록할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              해제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BlacklistPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    }>
      <BlacklistPageContent />
    </Suspense>
  );
}
