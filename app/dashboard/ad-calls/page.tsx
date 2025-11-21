'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, UserPlus, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

const SITES = [
  '용인경남아너스빌',
  '신광교클라우드시티',
  '평택 로제비앙',
  '왕십리 어반홈스',
];

interface AdCall {
  id: string;
  phone: string;
  source?: string;
  siteName?: string;
  status: 'PENDING' | 'ASSIGNED' | 'CONVERTED' | 'INVALID';
  assignedUser?: {
    id: string;
    name: string;
    username: string;
  };
  assignedBy?: {
    id: string;
    name: string;
  };
  assignedAt?: string;
  receivedAt: string;
  notes?: string;
  invalidReason?: string;
}

interface Stats {
  PENDING?: number;
  ASSIGNED?: number;
  CONVERTED?: number;
  INVALID?: number;
}

export default function AdCallsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [adCalls, setAdCalls] = useState<AdCall[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<Array<{ id: string; name: string; username: string; role: string }>>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  // 빠른 작업 다이얼로그
  const [quickActionDialogOpen, setQuickActionDialogOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<AdCall | null>(null);
  const [callNote, setCallNote] = useState('');

  // 단건 등록 폼 상태
  const [newPhone, setNewPhone] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newSite, setNewSite] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session?.user?.role || '');

  useEffect(() => {
    fetchAdCalls();
    if (isAdmin) {
      fetchUsers();
    }
  }, [statusFilter, siteFilter]);

  const fetchAdCalls = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/ad-calls?${params}`);
      const result = await response.json();

      if (result.success) {
        let filteredCalls = result.data;

        // 현장명 필터 적용
        if (siteFilter !== 'all') {
          filteredCalls = filteredCalls.filter(
            (call: AdCall) => call.siteName === siteFilter
          );
        }

        setAdCalls(filteredCalls);
        setStats(result.stats || {});
      }
    } catch (error) {
      console.error('Failed to fetch ad calls:', error);
      toast.error('광고 콜 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const result = await response.json();
      if (result.success) {
        setUsers(result.data.filter((u: { role: string }) => u.role !== 'PENDING'));
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleCreateSingle = async () => {
    const cleanedPhone = newPhone.replace(/\D/g, '');

    if (!cleanedPhone || cleanedPhone.length < 10) {
      toast.error('올바른 전화번호를 입력해주세요. (최소 10자리)');
      return;
    }

    try {
      const response = await fetch('/api/ad-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanedPhone,
          source: newSource || undefined,
          siteName: newSite || undefined,
          notes: newNotes || undefined,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('광고 콜이 등록되었습니다.');
        setCreateDialogOpen(false);
        setNewPhone('');
        setNewSource('');
        setNewSite('');
        setNewNotes('');
        fetchAdCalls();
      } else {
        toast.error('등록 실패: ' + result.error);
      }
    } catch (error) {
      console.error('Create error:', error);
      toast.error('등록 중 오류가 발생했습니다.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const calls = (jsonData as Record<string, unknown>[]).map((row) => ({
        phone: String(row['전화번호'] || row['phone'] || '').replace(/\D/g, ''),
        source: row['광고출처'] || row['source'],
        siteName: row['현장명'] || row['site'],
        notes: row['메모'] || row['notes'],
      }));

      const response = await fetch('/api/ad-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calls }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`${result.count}개의 광고 콜이 등록되었습니다.`);
        fetchAdCalls();
        setUploadDialogOpen(false);
      } else {
        toast.error('등록 실패: ' + result.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('파일 업로드 중 오류가 발생했습니다.');
    }
  };

  // 통화 기록 저장
  const handleSaveCallNote = async () => {
    if (!selectedCall || !callNote.trim()) {
      toast.error('통화 내용을 입력해주세요.');
      return;
    }

    try {
      const res = await fetch(`/api/ad-calls/${selectedCall.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: callNote }),
      });

      if (res.ok) {
        toast.success('통화 기록이 저장되었습니다.');
        setQuickActionDialogOpen(false);
        setCallNote('');
        fetchAdCalls();
      } else {
        throw new Error('Failed to save note');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('통화 기록 저장에 실패했습니다.');
    }
  };

  // 고객 등록 페이지로 이동
  const handleGoToRegister = () => {
    if (!selectedCall) return;
    setQuickActionDialogOpen(false);
    router.push(`/dashboard/customers/new?phone=${selectedCall.phone}&source=광고콜&site=${selectedCall.siteName || ''}`);
  };

  const handleBatchAssign = async () => {
    if (selectedCalls.size === 0) {
      toast.error('배분할 번호를 선택해주세요.');
      return;
    }

    if (!selectedUserId) {
      toast.error('배분할 직원을 선택해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/ad-calls/batch-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adCallIds: Array.from(selectedCalls),
          assignedUserId: selectedUserId,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        setSelectedCalls(new Set());
        setAssignDialogOpen(false);
        fetchAdCalls();
      } else {
        toast.error('배분 실패: ' + result.error);
      }
    } catch (error) {
      console.error('Assign error:', error);
      toast.error('배분 중 오류가 발생했습니다.');
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedCalls);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCalls(newSet);
  };

  const selectAll = () => {
    const pendingCalls = adCalls.filter(call => call.status === 'PENDING');
    setSelectedCalls(new Set(pendingCalls.map(call => call.id)));
  };

  const deselectAll = () => {
    setSelectedCalls(new Set());
  };

  // 전화번호 자동 포맷팅 함수
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');

    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else if (numbers.length <= 10) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setNewPhone(formatted);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'outline' | 'default' | 'secondary' | 'destructive'; label: string }> = {
      PENDING: { variant: 'outline', label: '대기' },
      ASSIGNED: { variant: 'default', label: '배분됨' },
      CONVERTED: { variant: 'secondary', label: '전환됨' },
      INVALID: { variant: 'destructive', label: '무효' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">광고 콜 관리</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            {isAdmin
              ? '광고로부터 받은 전화번호를 관리하고 배분합니다'
              : '광고로부터 받은 전화번호를 관리하고 코멘트 작성합니다'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  번호 등록
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>광고 콜 번호 등록</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone">전화번호 *</Label>
                    <Input
                      id="phone"
                      placeholder="010-1234-5678"
                      value={newPhone}
                      onChange={handlePhoneChange}
                      maxLength={13}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      하이픈은 자동으로 입력됩니다
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="site">현장명</Label>
                    <Select value={newSite} onValueChange={setNewSite}>
                      <SelectTrigger>
                        <SelectValue placeholder="현장 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {SITES.map((site) => (
                          <SelectItem key={site} value={site}>
                            {site}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="source">광고 출처</Label>
                    <Input
                      id="source"
                      placeholder="네이버/카카오/페이스북 등"
                      value={newSource}
                      onChange={(e) => setNewSource(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">메모</Label>
                    <Textarea
                      id="notes"
                      placeholder="메모"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleCreateSingle} className="w-full">
                    등록하기
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  엑셀 업로드
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>광고 콜 일괄 등록</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file-upload">엑셀 파일</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      필수 컬럼: 전화번호 (또는 phone)
                      <br />
                      선택 컬럼: 현장명, 광고출처, 메모
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card>
          <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              대기 중
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold">{stats.PENDING || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              배분됨
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold">{stats.ASSIGNED || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              고객 전환
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold">{stats.CONVERTED || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              무효
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold">{stats.INVALID || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 일괄 작업 */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[130px]">
                  <SelectValue placeholder="상태 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="PENDING">대기 중</SelectItem>
                  <SelectItem value="ASSIGNED">배분됨</SelectItem>
                  <SelectItem value="CONVERTED">전환됨</SelectItem>
                  <SelectItem value="INVALID">무효</SelectItem>
                </SelectContent>
              </Select>

              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="현장 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 현장</SelectItem>
                  {SITES.map((site) => (
                    <SelectItem key={site} value={site}>
                      {site}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && selectedCalls.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm text-muted-foreground">
                  {selectedCalls.size}개 선택됨
                </span>
                <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="w-4 h-4 mr-2" />
                      일괄 배분
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>광고 콜 일괄 배분</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>배분할 직원</Label>
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger>
                            <SelectValue placeholder="직원 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map(user => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name} ({user.username})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleBatchAssign} className="w-full">
                        {selectedCalls.size}개 번호 배분하기
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          {isAdmin && (
            <div className="flex gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={selectAll} className="text-xs md:text-sm">
                전체 선택
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll} className="text-xs md:text-sm">
                선택 해제
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && <TableHead className="w-12"></TableHead>}
                <TableHead>전화번호</TableHead>
                <TableHead>현장명</TableHead>
                <TableHead>광고 출처</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>배분된 직원</TableHead>
                <TableHead>접수일시</TableHead>
                <TableHead>메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="text-center">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : adCalls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="text-center">
                    광고 콜이 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                adCalls.map(call => (
                  <TableRow
                    key={call.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      // 광고콜을 클릭하면 빠른 작업 다이얼로그 표시
                      setSelectedCall(call);
                      setCallNote('');
                      setQuickActionDialogOpen(true);
                    }}
                  >
                    {isAdmin && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {call.status === 'PENDING' && (
                          <Checkbox
                            checked={selectedCalls.has(call.id)}
                            onCheckedChange={() => toggleSelection(call.id)}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-mono">{call.phone}</TableCell>
                    <TableCell>{call.siteName || '-'}</TableCell>
                    <TableCell>{call.source || '-'}</TableCell>
                    <TableCell>{getStatusBadge(call.status)}</TableCell>
                    <TableCell>
                      {call.assignedUser ? call.assignedUser.name : '-'}
                    </TableCell>
                    <TableCell>
                      {new Date(call.receivedAt).toLocaleString('ko-KR')}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {call.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* 빠른 작업 다이얼로그 */}
      <Dialog open={quickActionDialogOpen} onOpenChange={setQuickActionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>광고콜 처리</DialogTitle>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4">
              {/* 고객 정보 */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">전화번호</span>
                  <span className="font-mono font-semibold">{selectedCall.phone}</span>
                </div>
                {selectedCall.siteName && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">현장</span>
                    <span className="font-medium">{selectedCall.siteName}</span>
                  </div>
                )}
                {selectedCall.source && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">출처</span>
                    <span className="font-medium">{selectedCall.source}</span>
                  </div>
                )}
              </div>

              {/* 통화 기록 입력 */}
              <div className="space-y-2">
                <Label htmlFor="callNote">통화 내용</Label>
                <Textarea
                  id="callNote"
                  placeholder="통화 내용을 간단히 입력하세요..."
                  value={callNote}
                  onChange={(e) => setCallNote(e.target.value)}
                  rows={4}
                />
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveCallNote}
                  disabled={!callNote.trim()}
                  className="flex-1"
                >
                  통화 기록 저장
                </Button>
                <Button
                  onClick={handleGoToRegister}
                  variant="outline"
                  className="flex-1"
                >
                  고객 등록하기
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
