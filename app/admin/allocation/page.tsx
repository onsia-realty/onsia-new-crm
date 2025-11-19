'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, UserPlus, FileSpreadsheet, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  assignedSite?: string | null;
  assignedUserId?: string | null;
  assignedUser?: {
    id: string;
    name: string;
    email?: string | null;
    role?: string;
  } | null;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  position?: string;
  _count?: {
    customers: number;
  };
}

export default function AllocationPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [allocateReason, setAllocateReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('all');
  const [filterByUserId, setFilterByUserId] = useState<string>('all'); // 담당자별 필터 추가
  const [filterBySite, setFilterBySite] = useState<string>('all'); // 현장별 필터
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null); // Shift+클릭용
  const [page, setPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [adminDbCount, setAdminDbCount] = useState(0); // 관리자 DB 전체 카운트
  const [allocateSite, setAllocateSite] = useState<string>(''); // 배분 시 지정할 현장
  const ITEMS_PER_PAGE = 150;
  const { toast } = useToast();

  // 현장 옵션
  const SITE_OPTIONS = [
    { value: 'all', label: '전체 현장' },
    { value: 'none', label: '미지정' },
    { value: '용인경남아너스빌', label: '용인경남아너스빌' },
    { value: '신광교클라우드시티', label: '신광교클라우드시티' },
    { value: '평택로제비앙', label: '평택 로제비앙' },
    { value: '왕십리어반홈스', label: '왕십리 어반홈스' },
  ];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // 현장 필터 파라미터 구성
      let siteParam = '';
      if (filterBySite !== 'all') {
        siteParam = filterBySite === 'none' ? '&site=null' : `&site=${encodeURIComponent(filterBySite)}`;
      }

      // 담당자 필터 파라미터 구성
      let userParam = '';
      if (filterByUserId !== 'all') {
        userParam = `&assignedUserId=${filterByUserId}`;
      }

      const [customersRes, usersRes, statsRes] = await Promise.all([
        fetch(`/api/customers?limit=${ITEMS_PER_PAGE}&page=${page}&viewAll=true${siteParam}${userParam}`),
        fetch('/api/admin/users'),
        fetch('/api/admin/stats'), // 관리자 DB 통계 조회
      ]);

      if (!customersRes.ok || !usersRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const customersResponse = await customersRes.json();
      const usersData = await usersRes.json();

      // API 응답 구조에 따라 data 필드에서 실제 배열 추출
      setCustomers(customersResponse.data || []);
      setTotalCustomers(customersResponse.pagination?.total || 0);
      setTotalPages(customersResponse.pagination?.totalPages || 1);

      // 관리자 DB 통계
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setAdminDbCount(statsData.adminDbCount || 0);
      }

      // 직원 목록은 백엔드에서 _count를 포함해서 가져오므로 그대로 사용
      const usersWithCount = usersData
        .filter((u: User) => ['EMPLOYEE', 'TEAM_LEADER', 'HEAD'].includes(u.role))
        .map((u: User) => ({
          ...u,
          _count: u._count || { customers: 0 } // 백엔드에서 제공한 _count 사용
        }));

      setUsers(usersWithCount);
    } catch {
      toast({
        title: '오류',
        description: '데이터를 불러오는데 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, page, filterBySite, filterByUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAllocate = async () => {
    if (!selectedUser || selectedCustomers.length === 0) {
      toast({
        title: '오류',
        description: '담당자와 고객을 선택해주세요.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/admin/allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerIds: selectedCustomers,
          toUserId: selectedUser,
          reason: allocateReason,
          assignedSite: allocateSite || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to allocate customers');
      }

      toast({
        title: '성공',
        description: `${selectedCustomers.length}명의 고객이 배분되었습니다.`,
      });

      setSelectedCustomers([]);
      setSelectedUser('');
      setAllocateReason('');
      setAllocateSite('');
      setAllocateDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('배분 오류:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '고객 배분에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/admin/allocation/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload file');

      const result = await response.json();
      toast({
        title: '성공',
        description: `${result.created}명 생성, ${result.allocated}명 배분 완료`,
      });

      fetchData();
    } catch {
      toast({
        title: '오류',
        description: '엑셀 업로드에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const downloadTemplate = () => {
    const csvContent = 'name,phone,email,address,assignTo\n홍길동,01012345678,hong@example.com,서울시 강남구,employee@onsia.com';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'customer_template.csv';
    link.click();
  };

  const filteredCustomers = customers
    .filter(customer => {
      const matchesSearch =
        (customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        customer.phone.includes(searchTerm);

      const matchesAssignedFilter =
        filterAssigned === 'all' ||
        (filterAssigned === 'assigned' && customer.assignedUserId) ||
        (filterAssigned === 'unassigned' && !customer.assignedUserId);

      const matchesUserFilter =
        filterByUserId === 'all' ||
        customer.assignedUserId === filterByUserId;

      return matchesSearch && matchesAssignedFilter && matchesUserFilter;
    })
    .sort((a, b) => {
      // 관리자 배분 또는 미배분을 위로, 일반 직원 배분을 아래로 정렬
      const aIsAdminOrUnassigned = !a.assignedUserId || a.assignedUser?.name === '관리자';
      const bIsAdminOrUnassigned = !b.assignedUserId || b.assignedUser?.name === '관리자';

      if (aIsAdminOrUnassigned && !bIsAdminOrUnassigned) return -1;  // 관리자/미배분이 위로
      if (!aIsAdminOrUnassigned && bIsAdminOrUnassigned) return 1;   // 직원 배분이 아래로

      // 같은 상태면 최신 순으로 정렬
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const toggleCustomerSelection = (customerId: string, index: number, shiftKey: boolean) => {
    if (shiftKey && lastSelectedIndex !== null) {
      // Shift + 클릭: 범위 선택
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = filteredCustomers.slice(start, end + 1).map(c => c.id);

      setSelectedCustomers(prev => {
        const newSelection = new Set(prev);
        rangeIds.forEach(id => newSelection.add(id));
        return Array.from(newSelection);
      });
    } else {
      // 일반 클릭: 단일 선택/해제
      setSelectedCustomers(prev =>
        prev.includes(customerId)
          ? prev.filter(id => id !== customerId)
          : [...prev, customerId]
      );
      setLastSelectedIndex(index);
    }
  };

  const selectAllCustomers = () => {
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map(c => c.id));
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold">고객 배분 관리</CardTitle>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">전체 고객:</span>
                <span className="font-bold">{totalCustomers}명</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">배분됨:</span>
                <span className="font-bold text-green-600">
                  {customers.filter(c => c.assignedUserId).length}명
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">관리자 DB:</span>
                <span className="font-bold text-orange-600">
                  {adminDbCount}명
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">배분률:</span>
                <span className="font-bold text-blue-600">
                  {customers.length > 0
                    ? Math.round((customers.filter(c => c.assignedUserId).length / customers.length) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">수동 배분</TabsTrigger>
              <TabsTrigger value="excel">엑셀 업로드</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4">
              {/* 담당자별 통계 카드 */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                {users.map(user => {
                  const userCustomerCount = user._count?.customers || 0;
                  return (
                    <Card key={user.id} className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setFilterByUserId(filterByUserId === user.id ? 'all' : user.id)}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.position || user.role}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">{userCustomerCount}</p>
                            <p className="text-xs text-gray-500">담당 고객</p>
                          </div>
                        </div>
                        {filterByUserId === user.id && (
                          <div className="mt-2 pt-2 border-t">
                            <Badge className="text-xs">필터 적용됨</Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                <Card className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setFilterByUserId('all')}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">관리자 DB</p>
                        <p className="text-xs text-gray-500">미배분 + 관리자</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-600">
                          {adminDbCount}
                        </p>
                        <p className="text-xs text-gray-500">고객</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 필터 영역 */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="이름, 전화번호로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterAssigned} onValueChange={setFilterAssigned}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="배분 상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="assigned">배분됨</SelectItem>
                    <SelectItem value="unassigned">미배분</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterByUserId} onValueChange={(value) => { setFilterByUserId(value); setPage(1); }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="담당자 필터" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 담당자</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user._count?.customers || 0}명)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterBySite} onValueChange={(value) => { setFilterBySite(value); setPage(1); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="현장 필터" />
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => setAllocateDialogOpen(true)}
                  disabled={selectedCustomers.length === 0}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  선택 고객 배분 ({selectedCustomers.length})
                </Button>
              </div>

              {/* 고객 테이블 */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">No.</TableHead>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0}
                          onCheckedChange={selectAllCustomers}
                        />
                      </TableHead>
                      <TableHead>이름</TableHead>
                      <TableHead>전화번호</TableHead>
                      <TableHead>현장명</TableHead>
                      <TableHead>주소</TableHead>
                      <TableHead>
                        현재 담당자
                        <span className="text-xs text-gray-400 ml-1">(미배분↑)</span>
                      </TableHead>
                      <TableHead>등록일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          로딩 중...
                        </TableCell>
                      </TableRow>
                    ) : filteredCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          고객이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCustomers.map((customer, index) => (
                        <TableRow
                          key={customer.id}
                          className={!customer.assignedUserId ? 'bg-yellow-50' : 'bg-gray-50/50'}
                        >
                          <TableCell className="text-center font-mono text-sm">{index + 1}</TableCell>
                          <TableCell>
                            <div
                              onClick={(e) => {
                                e.preventDefault();
                                toggleCustomerSelection(customer.id, index, e.shiftKey);
                              }}
                              className="cursor-pointer inline-block"
                            >
                              <Checkbox
                                checked={selectedCustomers.includes(customer.id)}
                                onCheckedChange={() => {}} // div onClick이 처리하므로 비워둠
                              />
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <span
                              onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                              className="text-blue-600 hover:underline cursor-pointer"
                            >
                              {customer.name || '고객 ' + customer.id.slice(-6)}
                            </span>
                          </TableCell>
                          <TableCell>{customer.phone}</TableCell>
                          <TableCell>{customer.assignedSite || '-'}</TableCell>
                          <TableCell>{customer.address || '-'}</TableCell>
                          <TableCell>
                            {customer.assignedUser ? (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-100 text-green-800">배분됨</Badge>
                                <span className="text-sm">{customer.assignedUser.name}</span>
                              </div>
                            ) : (
                              <Badge variant="destructive">미배분 ⚠️</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('ko-KR') : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-500">
                    {totalCustomers}명 중 {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, totalCustomers)}명 표시
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                    >
                      처음
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      이전
                    </Button>
                    <span className="px-3 py-1 text-sm">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      다음
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                    >
                      마지막
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="excel" className="space-y-4">
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">엑셀 파일 업로드</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    고객 정보와 담당자를 포함한 엑셀 파일을 업로드하여 일괄 배분할 수 있습니다.
                  </p>
                  <div className="flex justify-center gap-4">
                    <Button variant="outline" onClick={downloadTemplate}>
                      <Download className="mr-2 h-4 w-4" />
                      템플릿 다운로드
                    </Button>
                    <label>
                      <Input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={handleExcelUpload}
                      />
                      <Button asChild>
                        <span>
                          <Upload className="mr-2 h-4 w-4" />
                          파일 선택
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium mb-2">엑셀 업로드 가이드</h4>
                  <ul className="text-sm space-y-1 text-gray-700">
                    <li>• 컬럼: name(이름), phone(전화번호), email(이메일), address(주소), assignTo(담당자 이메일)</li>
                    <li>• 전화번호는 자동으로 숫자만 추출되어 저장됩니다</li>
                    <li>• 중복된 전화번호는 기존 고객 정보를 업데이트합니다</li>
                    <li>• assignTo에 입력된 이메일로 자동 배분됩니다</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 배분 다이얼로그 */}
      <Dialog open={allocateDialogOpen} onOpenChange={setAllocateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>고객 배분</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>선택된 고객</Label>
              <p className="text-sm text-gray-600">
                {selectedCustomers.length}명의 고객이 선택되었습니다.
              </p>
            </div>
            <div>
              <Label>담당자 선택</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="담당자를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} - {user.position || user.role} 
                      ({user._count?.customers || 0}명 담당 중)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>현장 지정</Label>
              <Select value={allocateSite || 'none'} onValueChange={(value) => setAllocateSite(value === 'none' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="현장을 선택하세요 (선택)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">현장 미지정</SelectItem>
                  <SelectItem value="용인경남아너스빌">용인경남아너스빌</SelectItem>
                  <SelectItem value="신광교클라우드시티">신광교클라우드시티</SelectItem>
                  <SelectItem value="평택로제비앙">평택 로제비앙</SelectItem>
                  <SelectItem value="왕십리어반홈스">왕십리 어반홈스</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>배분 사유</Label>
              <Textarea
                placeholder="배분 사유를 입력하세요 (선택)"
                value={allocateReason}
                onChange={(e) => setAllocateReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAllocate}>
              배분하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}