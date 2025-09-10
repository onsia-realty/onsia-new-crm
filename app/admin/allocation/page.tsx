'use client';

import { useState, useEffect } from 'react';
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
import { Search, Users, UserPlus, FileSpreadsheet, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  assignedUserId?: string;
  assignedUser?: {
    id: string;
    name: string;
    role: string;
    department?: string;
  };
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [allocateReason, setAllocateReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('all');
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersRes, usersRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/admin/users'),
      ]);

      if (!customersRes.ok || !usersRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const customersData = await customersRes.json();
      const usersData = await usersRes.json();

      setCustomers(customersData);
      setUsers(usersData.filter((u: User) => 
        ['EMPLOYEE', 'TEAM_LEADER', 'HEAD'].includes(u.role)
      ));
    } catch (error) {
      toast({
        title: '오류',
        description: '데이터를 불러오는데 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

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
        }),
      });

      if (!response.ok) throw new Error('Failed to allocate customers');

      toast({
        title: '성공',
        description: `${selectedCustomers.length}명의 고객이 배분되었습니다.`,
      });

      setSelectedCustomers([]);
      setSelectedUser('');
      setAllocateReason('');
      setAllocateDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({
        title: '오류',
        description: '고객 배분에 실패했습니다.',
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
    } catch (error) {
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

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm);
    
    const matchesFilter = 
      filterAssigned === 'all' ||
      (filterAssigned === 'assigned' && customer.assignedUserId) ||
      (filterAssigned === 'unassigned' && !customer.assignedUserId);

    return matchesSearch && matchesFilter;
  });

  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
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
          <CardTitle className="text-2xl font-bold">고객 배분 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">수동 배분</TabsTrigger>
              <TabsTrigger value="excel">엑셀 업로드</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4">
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
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0}
                          onCheckedChange={selectAllCustomers}
                        />
                      </TableHead>
                      <TableHead>이름</TableHead>
                      <TableHead>전화번호</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead>주소</TableHead>
                      <TableHead>현재 담당자</TableHead>
                      <TableHead>등록일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          로딩 중...
                        </TableCell>
                      </TableRow>
                    ) : filteredCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          고객이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedCustomers.includes(customer.id)}
                              onCheckedChange={() => toggleCustomerSelection(customer.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell>{customer.phone}</TableCell>
                          <TableCell>{customer.email || '-'}</TableCell>
                          <TableCell>{customer.address || '-'}</TableCell>
                          <TableCell>
                            {customer.assignedUser ? (
                              <div>
                                <span className="font-medium">{customer.assignedUser.name}</span>
                                <span className="text-sm text-gray-500 ml-2">
                                  ({customer.assignedUser.department})
                                </span>
                              </div>
                            ) : (
                              <Badge variant="outline">미배분</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(customer.createdAt).toLocaleDateString('ko-KR')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
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