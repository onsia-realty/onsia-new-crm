'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, FileText, CheckCircle, Clock, Filter } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Contract {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  assignedSite: string | null;
  status: 'SUBSCRIBED' | 'COMPLETED' | 'CANCELLED';
  contractDate: string | null;
  subscriptionDate: string | null;
  amount: number | null;
  memo: string | null;
  userId: string;
  userName: string;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  subscribed: number;
  completed: number;
  cancelled: number;
}

const SITES = [
  '용인경남아너스빌',
  '신광교클라우드시티',
  '평택 로제비앙',
  '왕십리 어반홈스',
];

export default function ContractsPage() {
  const { data: session } = useSession();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, subscribed: 0, completed: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // 신규 등록 폼
  const [newContract, setNewContract] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    assignedSite: '',
    status: 'SUBSCRIBED' as 'SUBSCRIBED' | 'COMPLETED',
    amount: '',
    memo: '',
  });

  const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session?.user?.role || '');

  useEffect(() => {
    fetchContracts();
  }, [statusFilter, siteFilter]);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (siteFilter !== 'all') {
        params.append('site', siteFilter);
      }

      const response = await fetch(`/api/contracts?${params}`);
      const result = await response.json();

      if (result.success) {
        setContracts(result.data);
        setStats(result.stats);
      } else {
        toast.error(result.error || '계약 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch contracts:', error);
      toast.error('계약 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContract = async () => {
    if (!newContract.customerPhone.trim()) {
      toast.error('고객 전화번호를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newContract,
          amount: newContract.amount ? parseInt(newContract.amount) : null,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('계약이 등록되었습니다.');
        setCreateDialogOpen(false);
        setNewContract({
          customerId: '',
          customerName: '',
          customerPhone: '',
          assignedSite: '',
          status: 'SUBSCRIBED',
          amount: '',
          memo: '',
        });
        fetchContracts();
      } else {
        toast.error(result.error || '등록 실패');
      }
    } catch (error) {
      console.error('Create contract error:', error);
      toast.error('계약 등록 중 오류가 발생했습니다.');
    }
  };

  const handleStatusChange = async (contractId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('상태가 변경되었습니다.');
        fetchContracts();
      } else {
        toast.error(result.error || '상태 변경 실패');
      }
    } catch (error) {
      console.error('Status change error:', error);
      toast.error('상태 변경 중 오류가 발생했습니다.');
    }
  };

  const filteredContracts = contracts.filter((contract) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      contract.customerName?.toLowerCase().includes(term) ||
      contract.customerPhone.includes(term) ||
      contract.userName.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBSCRIBED':
        return <Badge className="bg-green-100 text-green-800">청약</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-blue-100 text-blue-800">계약완료</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-gray-100 text-gray-800">취소</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: number | null) => {
    if (!amount) return '-';
    return `${(amount / 10000).toLocaleString()}만원`;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">계약 대장</h1>
          <p className="text-sm text-muted-foreground mt-1">
            청약 및 계약 현황을 관리합니다
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              신규 등록
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>청약/계약 등록</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>고객명</Label>
                <Input
                  placeholder="고객명"
                  value={newContract.customerName}
                  onChange={(e) => setNewContract({ ...newContract, customerName: e.target.value })}
                />
              </div>
              <div>
                <Label>전화번호 *</Label>
                <Input
                  placeholder="010-1234-5678"
                  value={newContract.customerPhone}
                  onChange={(e) => setNewContract({ ...newContract, customerPhone: e.target.value })}
                />
              </div>
              <div>
                <Label>현장</Label>
                <Select
                  value={newContract.assignedSite}
                  onValueChange={(v) => setNewContract({ ...newContract, assignedSite: v })}
                >
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
                <Label>상태</Label>
                <Select
                  value={newContract.status}
                  onValueChange={(v) => setNewContract({ ...newContract, status: v as 'SUBSCRIBED' | 'COMPLETED' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUBSCRIBED">청약</SelectItem>
                    <SelectItem value="COMPLETED">계약완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>계약금액 (만원)</Label>
                <Input
                  type="number"
                  placeholder="예: 5000"
                  value={newContract.amount}
                  onChange={(e) => setNewContract({ ...newContract, amount: e.target.value })}
                />
              </div>
              <div>
                <Label>메모</Label>
                <Textarea
                  placeholder="특이사항"
                  value={newContract.memo}
                  onChange={(e) => setNewContract({ ...newContract, memo: e.target.value })}
                />
              </div>
              <Button onClick={handleCreateContract} className="w-full">
                등록하기
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-500">전체</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              <span className="text-sm text-gray-500">청약</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.subscribed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-gray-500">계약완료</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">취소</span>
            </div>
            <div className="text-2xl font-bold text-gray-400 mt-1">{stats.cancelled}</div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 검색 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="고객명, 전화번호, 담당자 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  <SelectItem value="SUBSCRIBED">청약</SelectItem>
                  <SelectItem value="COMPLETED">계약완료</SelectItem>
                  <SelectItem value="CANCELLED">취소</SelectItem>
                </SelectContent>
              </Select>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="현장" />
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
          </div>
        </CardHeader>
        <CardContent>
          {/* PC 테이블 뷰 */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>고객명</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>현장</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>계약금액</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead>등록일</TableHead>
                  {isAdmin && <TableHead>관리</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8">
                      로딩 중...
                    </TableCell>
                  </TableRow>
                ) : filteredContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8">
                      등록된 계약이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>
                        {contract.customerId ? (
                          <Link
                            href={`/dashboard/customers/${contract.customerId}`}
                            className="text-blue-600 hover:underline"
                          >
                            {contract.customerName || '미등록'}
                          </Link>
                        ) : (
                          contract.customerName || '미등록'
                        )}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatPhoneNumber(contract.customerPhone)}
                      </TableCell>
                      <TableCell>{contract.assignedSite || '-'}</TableCell>
                      <TableCell>{getStatusBadge(contract.status)}</TableCell>
                      <TableCell>{formatAmount(contract.amount)}</TableCell>
                      <TableCell>{contract.userName}</TableCell>
                      <TableCell>{formatDate(contract.createdAt)}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Select
                            value={contract.status}
                            onValueChange={(v) => handleStatusChange(contract.id, v)}
                          >
                            <SelectTrigger className="w-[100px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SUBSCRIBED">청약</SelectItem>
                              <SelectItem value="COMPLETED">계약완료</SelectItem>
                              <SelectItem value="CANCELLED">취소</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 모바일 카드 뷰 */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">등록된 계약이 없습니다</div>
            ) : (
              filteredContracts.map((contract) => (
                <div key={contract.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">
                        {contract.customerId ? (
                          <Link
                            href={`/dashboard/customers/${contract.customerId}`}
                            className="text-blue-600 hover:underline"
                          >
                            {contract.customerName || '미등록'}
                          </Link>
                        ) : (
                          contract.customerName || '미등록'
                        )}
                      </div>
                      <div className="text-sm text-gray-500 font-mono">
                        {formatPhoneNumber(contract.customerPhone)}
                      </div>
                    </div>
                    {getStatusBadge(contract.status)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{contract.assignedSite || '현장 미지정'}</span>
                    <span className="font-medium">{formatAmount(contract.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>담당: {contract.userName}</span>
                    <span>{formatDate(contract.createdAt)}</span>
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
