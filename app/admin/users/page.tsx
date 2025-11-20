'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Edit, Trash2, Check, X, Phone, Mail, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  department?: string;
  position?: string;
  teamId?: string;
  isActive: boolean;
  approvedAt?: string;
  joinedAt: string;
  lastLoginAt?: string;
  _count?: {
    customers: number;
  };
}

const roleLabels: Record<string, string> = {
  PENDING: '승인 대기',
  EMPLOYEE: '직원',
  TEAM_LEADER: '팀장',
  HEAD: '본부장',
  ADMIN: '관리자',
  CEO: '대표',
};

const roleColors: Record<string, string> = {
  PENDING: 'secondary',
  EMPLOYEE: 'default',
  TEAM_LEADER: 'blue',
  HEAD: 'purple',
  ADMIN: 'destructive',
  CEO: 'destructive',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to fetch users (${response.status})`);
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '사용자 목록을 불러오는데 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleApprove = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to approve user');
      
      toast({
        title: '성공',
        description: '사용자가 승인되었습니다.',
      });
      fetchUsers();
    } catch {
      toast({
        title: '오류',
        description: '사용자 승인에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to reject user');
      
      toast({
        title: '성공',
        description: '사용자가 거부되었습니다.',
      });
      fetchUsers();
    } catch {
      toast({
        title: '오류',
        description: '사용자 거부에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!response.ok) throw new Error('Failed to update role');

      toast({
        title: '성공',
        description: '권한이 변경되었습니다.',
      });
      fetchUsers();
      setEditDialogOpen(false);
    } catch {
      toast({
        title: '오류',
        description: '권한 변경에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    if (!confirm(`${userName} 직원의 비밀번호를 0000으로 초기화하시겠습니까?\n\n다음 로그인 시 비밀번호 변경이 필요합니다.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset password');
      }

      const data = await response.json();

      toast({
        title: '성공',
        description: data.message || '비밀번호가 초기화되었습니다.',
      });
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '비밀번호 초기화에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    // 관리자는 항상 완전 삭제
    if (!confirm(`⚠️ ${userName} 직원을 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.\n담당 고객은 관리자에게 재배분됩니다.`)) {
      return;
    }

    try {
      // 관리자는 항상 완전 삭제
      const url = `/api/admin/users/${userId}?permanent=true`;

      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      const data = await response.json();

      toast({
        title: '성공',
        description: data.message || '직원이 완전히 삭제되었습니다.',
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '직원 삭제에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm);
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = 
      filterStatus === 'all' ||
      (filterStatus === 'active' && user.isActive) ||
      (filterStatus === 'inactive' && !user.isActive) ||
      (filterStatus === 'pending' && user.role === 'PENDING');

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">사용자 관리</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 필터 영역 */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="이름, 이메일, 전화번호로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="권한 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 권한</SelectItem>
                <SelectItem value="CEO">대표</SelectItem>
                <SelectItem value="ADMIN">관리자</SelectItem>
                <SelectItem value="HEAD">본부장</SelectItem>
                <SelectItem value="TEAM_LEADER">팀장</SelectItem>
                <SelectItem value="EMPLOYEE">직원</SelectItem>
                <SelectItem value="PENDING">승인 대기</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="상태 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상태</SelectItem>
                <SelectItem value="active">활성</SelectItem>
                <SelectItem value="inactive">비활성</SelectItem>
                <SelectItem value="pending">승인 대기</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 사용자 테이블 */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>부서/팀</TableHead>
                  <TableHead>권한</TableHead>
                  <TableHead>고객 수</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead>마지막 로그인</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      로딩 중...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      사용자가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-gray-400" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-gray-400" />
                          {user.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.department && user.position ? 
                          `${user.department} / ${user.position}` : 
                          '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleColors[user.role] as 'default' | 'secondary' | 'destructive' | 'outline'}>
                          {roleLabels[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>{user._count?.customers || 0}</TableCell>
                      <TableCell>
                        {user.role === 'PENDING' ? (
                          <Badge variant="outline">승인 대기</Badge>
                        ) : user.isActive ? (
                          <Badge variant="outline" className="text-green-600">활성</Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600">비활성</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(user.joinedAt).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        {user.lastLoginAt ? 
                          new Date(user.lastLoginAt).toLocaleDateString('ko-KR') : 
                          '-'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {user.role === 'PENDING' ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(user.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(user.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : user.role === 'CEO' ? (
                            <Badge variant="outline" className="text-gray-500">
                              편집 불가
                            </Badge>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setEditDialogOpen(true);
                                }}
                                title="권한 수정"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                onClick={() => handleResetPassword(user.id, user.name)}
                                title="비밀번호 0000으로 초기화"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                title="삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 권한 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>권한 수정</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label>사용자</Label>
                <p className="text-sm text-gray-600">
                  {selectedUser.name} ({selectedUser.email})
                </p>
              </div>
              <div>
                <Label>권한</Label>
                <Select
                  defaultValue={selectedUser.role}
                  onValueChange={(value) => handleUpdateRole(selectedUser.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">직원</SelectItem>
                    <SelectItem value="TEAM_LEADER">팀장</SelectItem>
                    <SelectItem value="HEAD">본부장</SelectItem>
                    <SelectItem value="ADMIN">관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}