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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, ArrowLeft, Phone } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

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
  receivedAt: string;
  notes?: string;
}

export default function AdCallDistributePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [adCalls, setAdCalls] = useState<AdCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<Array<{ id: string; name: string; username: string; role: string }>>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session?.user?.role || '');

  useEffect(() => {
    if (session && !isAdmin) {
      router.push('/dashboard');
      return;
    }
    fetchAdCalls();
    fetchUsers();
  }, [session, isAdmin, siteFilter]);

  const fetchAdCalls = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('status', 'PENDING');

      const response = await fetch(`/api/ad-calls?${params}`);
      const result = await response.json();

      if (result.success) {
        let filteredCalls = result.data;

        if (siteFilter !== 'all') {
          filteredCalls = filteredCalls.filter(
            (call: AdCall) => call.siteName === siteFilter
          );
        }

        setAdCalls(filteredCalls);
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
        setSelectedUserId('');
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
    setSelectedCalls(new Set(adCalls.map(call => call.id)));
  };

  const deselectAll = () => {
    setSelectedCalls(new Set());
  };

  if (!session || !isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-3xl font-bold flex items-center gap-2">
              <Phone className="h-6 w-6 text-orange-600" />
              광고콜 배분
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              대기 중인 광고콜을 직원에게 배분합니다
            </p>
          </div>
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">대기 중</div>
            <div className="text-2xl font-bold text-orange-600">{adCalls.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">선택됨</div>
            <div className="text-2xl font-bold text-blue-600">{selectedCalls.size}</div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 배분 버튼 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
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

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll} className="flex-1 md:flex-none">
                전체 선택
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll} className="flex-1 md:flex-none">
                선택 해제
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 배분 버튼 - 선택 시 표시 */}
          {selectedCalls.size > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <span className="text-sm font-medium text-blue-800">
                {selectedCalls.size}개 선택됨
              </span>
              <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full md:w-auto">
                    <UserPlus className="w-4 h-4 mr-2" />
                    배분하기
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>광고콜 배분</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>배분할 직원 선택</Label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger className="mt-2">
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
                    <Button onClick={handleBatchAssign} className="w-full" disabled={!selectedUserId}>
                      {selectedCalls.size}개 번호 배분하기
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* 테이블 - 모바일에서는 카드 형태로 */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>현장명</TableHead>
                  <TableHead>광고 출처</TableHead>
                  <TableHead>접수일시</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      로딩 중...
                    </TableCell>
                  </TableRow>
                ) : adCalls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      대기 중인 광고콜이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  adCalls.map(call => (
                    <TableRow
                      key={call.id}
                      className={selectedCalls.has(call.id) ? 'bg-blue-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedCalls.has(call.id)}
                          onCheckedChange={() => toggleSelection(call.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{call.phone}</TableCell>
                      <TableCell>{call.siteName || '-'}</TableCell>
                      <TableCell>{call.source || '-'}</TableCell>
                      <TableCell>
                        {new Date(call.receivedAt).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 모바일 카드 뷰 */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                로딩 중...
              </div>
            ) : adCalls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                대기 중인 광고콜이 없습니다
              </div>
            ) : (
              adCalls.map(call => (
                <div
                  key={call.id}
                  className={`p-3 border rounded-lg ${selectedCalls.has(call.id) ? 'bg-blue-50 border-blue-200' : ''}`}
                  onClick={() => toggleSelection(call.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-mono font-medium">{call.phone}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {call.siteName || '현장 미지정'}
                        {call.source && ` · ${call.source}`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(call.receivedAt).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <Checkbox
                      checked={selectedCalls.has(call.id)}
                      onCheckedChange={() => toggleSelection(call.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
