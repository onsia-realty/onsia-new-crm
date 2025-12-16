'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Save, Edit2, Trash2, Send, X, CalendarIcon, ArrowRight, Phone, Users, FileText, Plus, MapPin, Clock, CheckCircle, XCircle, Calendar as CalendarLucide, Ban, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import AddScheduleDialog from '@/components/schedules/AddScheduleDialog';

interface Customer {
  id: string;
  name: string;
  phone: string;
  isDuplicate?: boolean;
  memo: string | null;
  nextVisitDate: string | null;
  assignedSite: string | null;
  assignedUserId?: string;
  assignedUser?: {
    id: string;
    name: string;
    email: string;
  };
  gender: string | null;
  ageRange: string | null;
  residenceArea: string | null;
  familyRelation: string | null;
  occupation: string | null;
  source: string | null;
  grade: string;
  investmentStyle: string | null;
  expectedBudget: number | null;
  ownedProperties: string | null;
  recentVisitedMH: string | null;
  createdAt: string;
  visitSchedules: Array<{
    id: string;
    visitDate: string;
    visitType: string;
    location: string;
    status: string;
  }>;
}

interface CallLog {
  id: string;
  content: string;
  note: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
}

interface AllocationHistory {
  id: string;
  from: string;
  to: string;
  allocatedBy: string;
  reason: string;
  createdAt: string;
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: customerId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [allocationHistory, setAllocationHistory] = useState<AllocationHistory[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newCallLog, setNewCallLog] = useState('');
  const [addingCallLog, setAddingCallLog] = useState(false);
  const [editingCallLogId, setEditingCallLogId] = useState<string | null>(null);
  const [editingCallLogContent, setEditingCallLogContent] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({ toUserId: '', reason: '' });
  const [transferLoading, setTransferLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [navigationData, setNavigationData] = useState<{ customerIds: string[]; currentIndex: number } | null>(null);

  // 방문일정 관련 상태
  const [showAddScheduleDialog, setShowAddScheduleDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Customer['visitSchedules'][0] | null>(null);
  const [showCancelScheduleDialog, setShowCancelScheduleDialog] = useState(false);
  const [cancellingScheduleId, setCancellingScheduleId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // 블랙리스트 상태
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [blacklistInfo, setBlacklistInfo] = useState<{
    id?: string;
    reason: string;
    registeredBy?: { name: string };
    createdAt: string;
  } | null>(null);
  const [showBlacklistDialog, setShowBlacklistDialog] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [blacklistLoading, setBlacklistLoading] = useState(false);

  // 폼 데이터 (수정 모드용)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    memo: '',
    nextVisitDate: undefined as Date | undefined,
    assignedSite: '',
    gender: '',
    ageRange: '',
    residenceArea: '',
    familyRelation: '',
    occupation: '',
    source: '',
    grade: 'C',
    investmentStyle: {
      timeProfit: false,
      monthlyIncome: false,
      residence: false
    },
    expectedBudget: '',
    ownedProperties: {
      apt: false,
      officetel: false,
      commercial: false,
      building: false
    },
    recentVisitedMH: ''
  });

  // 페이지 로드 시 네비게이션 데이터 복원
  useEffect(() => {
    const savedNavigation = sessionStorage.getItem('customerNavigation');
    if (savedNavigation) {
      try {
        const navData = JSON.parse(savedNavigation);
        setNavigationData(navData);
      } catch (e) {
        console.error('Failed to parse navigation data:', e);
      }
    }
  }, []);

  // 이전/다음 고객 이동
  const handleNavigateCustomer = (direction: 'prev' | 'next') => {
    if (!navigationData) return;

    const { customerIds, currentIndex } = navigationData;
    let newIndex = currentIndex;

    if (direction === 'prev') {
      newIndex = currentIndex - 1;
    } else {
      newIndex = currentIndex + 1;
    }

    if (newIndex >= 0 && newIndex < customerIds.length) {
      const nextCustomerId = customerIds[newIndex];
      // 네비게이션 데이터 업데이트
      const updatedNavData = { ...navigationData, currentIndex: newIndex };
      sessionStorage.setItem('customerNavigation', JSON.stringify(updatedNavData));
      router.push(`/dashboard/customers/${nextCustomerId}`);
    }
  };

  const fetchCustomer = useCallback(async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      const result = await response.json();

      if (result.success) {
        setCustomer(result.data);
        // 폼 데이터 초기화
        const c = result.data;
        setFormData({
          name: c.name,
          phone: c.phone,
          memo: c.memo || '',
          nextVisitDate: c.nextVisitDate ? new Date(c.nextVisitDate) : undefined,
          assignedSite: c.assignedSite || '',
          gender: c.gender || '',
          ageRange: c.ageRange || '',
          residenceArea: c.residenceArea || '',
          familyRelation: c.familyRelation || '',
          occupation: c.occupation || '',
          source: c.source || '',
          grade: c.grade || 'C',
          investmentStyle: c.investmentStyle ? JSON.parse(c.investmentStyle) : {
            timeProfit: false,
            monthlyIncome: false,
            residence: false
          },
          expectedBudget: c.expectedBudget ? String(c.expectedBudget) : '',
          ownedProperties: c.ownedProperties ? JSON.parse(c.ownedProperties) : {
            apt: false,
            officetel: false,
            commercial: false,
            building: false
          },
          recentVisitedMH: c.recentVisitedMH || ''
        });
      }
    } catch (error) {
      console.error('Failed to fetch customer:', error);
      toast({
        title: '오류',
        description: '고객 정보를 불러오는데 실패했습니다.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [customerId, toast]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users');
      const result = await response.json();
      if (result.success) {
        setUsers(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }, []);

  const fetchCallLogs = useCallback(async () => {
    try {
      const response = await fetch(`/api/call-logs?customerId=${customerId}`);
      const result = await response.json();

      if (result.success) {
        setCallLogs(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch call logs:', error);
    }
  }, [customerId]);

  const fetchAllocationHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}/allocation-history`);
      const result = await response.json();

      if (result.success) {
        setAllocationHistory(result.data.history);
      }
    } catch (error) {
      console.error('Failed to fetch allocation history:', error);
    }
  }, [customerId]);

  // 블랙리스트 체크
  const checkBlacklist = useCallback(async (phone: string) => {
    try {
      const response = await fetch(`/api/blacklist/check?phone=${encodeURIComponent(phone)}`);
      const result = await response.json();

      if (result.success) {
        setIsBlacklisted(result.isBlacklisted);
        setBlacklistInfo(result.data);
      }
    } catch (error) {
      console.error('Failed to check blacklist:', error);
    }
  }, []);

  useEffect(() => {
    fetchCustomer();
    fetchCallLogs();
    fetchAllocationHistory();
    fetchUsers();
  }, [fetchCustomer, fetchCallLogs, fetchAllocationHistory, fetchUsers]);

  // 고객 정보가 로드되면 블랙리스트 체크
  useEffect(() => {
    if (customer?.phone) {
      checkBlacklist(customer.phone);
    }
  }, [customer?.phone, checkBlacklist]);

  const handleSave = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          memo: formData.memo || undefined,
          nextVisitDate: formData.nextVisitDate ? formData.nextVisitDate.toISOString() : undefined,
          assignedSite: formData.assignedSite || undefined,
          gender: formData.gender || undefined,
          ageRange: formData.ageRange || undefined,
          residenceArea: formData.residenceArea || undefined,
          familyRelation: formData.familyRelation || undefined,
          occupation: formData.occupation || undefined,
          source: formData.source || undefined,
          grade: formData.grade,
          investmentStyle: JSON.stringify(formData.investmentStyle),
          expectedBudget: formData.expectedBudget ? parseInt(formData.expectedBudget) : undefined,
          ownedProperties: JSON.stringify(formData.ownedProperties),
          recentVisitedMH: formData.recentVisitedMH || undefined
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: '성공',
          description: '고객 정보가 수정되었습니다.'
        });
        setIsEditing(false);
        fetchCustomer();
      } else {
        throw new Error(result.error || '수정 실패');
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '고객 정보 수정에 실패했습니다.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCallLog = async () => {
    if (!newCallLog.trim() || addingCallLog) return;

    setAddingCallLog(true);
    try {
      const response = await fetch('/api/call-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId,
          content: newCallLog
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '성공',
          description: '통화 기록이 등록되었습니다.'
        });
        setNewCallLog('');
        fetchCallLogs();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error adding call log:', error);
      toast({
        title: '오류',
        description: '통화 기록 등록에 실패했습니다.',
        variant: 'destructive'
      });
    } finally {
      setAddingCallLog(false);
    }
  };

  const handleUpdateCallLog = async (id: string) => {
    try {
      const response = await fetch(`/api/call-logs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editingCallLogContent
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '성공',
          description: '통화 기록이 수정되었습니다.'
        });
        setEditingCallLogId(null);
        setEditingCallLogContent('');
        fetchCallLogs();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error updating call log:', error);
      toast({
        title: '오류',
        description: '통화 기록 수정에 실패했습니다.',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteCustomer = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: '성공',
          description: '고객이 삭제되었습니다.'
        });
        router.push('/dashboard/customers');
      } else {
        throw new Error(result.error || '삭제 실패');
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '고객 삭제에 실패했습니다.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteCallLog = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/call-logs/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '성공',
          description: '통화 기록이 삭제되었습니다.'
        });
        fetchCallLogs();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error deleting call log:', error);
      toast({
        title: '오류',
        description: '통화 기록 삭제에 실패했습니다.',
        variant: 'destructive'
      });
    }
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleInvestmentStyleChange = (field: keyof typeof formData.investmentStyle) => {
    setFormData(prev => ({
      ...prev,
      investmentStyle: {
        ...prev.investmentStyle,
        [field]: !prev.investmentStyle[field]
      }
    }));
  };

  const handleOwnedPropertiesChange = (field: keyof typeof formData.ownedProperties) => {
    setFormData(prev => ({
      ...prev,
      ownedProperties: {
        ...prev.ownedProperties,
        [field]: !prev.ownedProperties[field]
      }
    }));
  };

  const formatPhoneDisplay = (phone: string) => {
    if (phone.length === 11) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    }
    return phone;
  };

  const handleTransferRequest = async () => {
    if (!transferData.toUserId || !transferData.reason.trim()) {
      toast({
        title: '오류',
        description: '담당자와 변경 사유를 입력해주세요.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setTransferLoading(true);
      const response = await fetch(`/api/customers/${customerId}/request-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: transferData.toUserId,
          reason: transferData.reason
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: '성공',
          description: '담당자 변경 요청이 등록되었습니다.'
        });
        setShowTransferModal(false);
        setTransferData({ toUserId: '', reason: '' });
      } else {
        throw new Error(result.error || '담당자 변경 요청 실패');
      }
    } catch (error) {
      console.error('Error requesting transfer:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '담당자 변경 요청에 실패했습니다.',
        variant: 'destructive'
      });
    } finally {
      setTransferLoading(false);
    }
  };

  const parseProperties = (json: string | null) => {
    if (!json) return '없음';
    try {
      const props = JSON.parse(json);
      const types = [];
      if (props.apt) types.push('아파트');
      if (props.officetel) types.push('오피스텔');
      if (props.commercial) types.push('상가');
      if (props.building) types.push('빌딩');
      return types.length > 0 ? types.join(', ') : '없음';
    } catch {
      return '없음';
    }
  };

  const parseInvestmentStyle = (json: string | null) => {
    if (!json) return '없음';
    try {
      const style = JSON.parse(json);
      const types = [];
      if (style.timeProfit) types.push('시세차익');
      if (style.monthlyIncome) types.push('월수익');
      if (style.residence) types.push('실거주');
      return types.length > 0 ? types.join(', ') : '없음';
    } catch {
      return '없음';
    }
  };

  // 방문 일정 상태 변경
  const handleScheduleStatusChange = async (scheduleId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/visit-schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: '성공',
          description: newStatus === 'COMPLETED' ? '방문이 완료 처리되었습니다.' : '일정 상태가 변경되었습니다.'
        });
        fetchCustomer();
      } else {
        throw new Error(result.error || '상태 변경 실패');
      }
    } catch (error) {
      console.error('Error updating schedule status:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '상태 변경에 실패했습니다.',
        variant: 'destructive'
      });
    }
  };

  // 블랙리스트 등록
  const handleRegisterBlacklist = async () => {
    if (!blacklistReason.trim()) {
      toast({
        title: '입력 오류',
        description: '블랙리스트 사유를 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setBlacklistLoading(true);
    try {
      const response = await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: customer?.phone,
          reason: blacklistReason,
          customerName: customer?.name,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: '등록 완료',
          description: '블랙리스트에 등록되었습니다.',
        });
        setShowBlacklistDialog(false);
        setBlacklistReason('');
        // 블랙리스트 상태 새로고침
        if (customer?.phone) {
          checkBlacklist(customer.phone);
        }
      } else {
        throw new Error(result.error || '블랙리스트 등록 실패');
      }
    } catch (error) {
      console.error('Error registering blacklist:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '블랙리스트 등록에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setBlacklistLoading(false);
    }
  };

  // 블랙리스트 해제
  const handleRemoveBlacklist = async () => {
    if (!blacklistInfo?.id) return;

    setBlacklistLoading(true);
    try {
      const response = await fetch(`/api/blacklist/${blacklistInfo.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: '해제 완료',
          description: '블랙리스트에서 해제되었습니다.',
        });
        setIsBlacklisted(false);
        setBlacklistInfo(null);
      } else {
        throw new Error(result.error || '블랙리스트 해제 실패');
      }
    } catch (error) {
      console.error('Error removing blacklist:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '블랙리스트 해제에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setBlacklistLoading(false);
    }
  };

  // 방문 일정 취소
  const handleCancelSchedule = async () => {
    if (!cancellingScheduleId) return;

    try {
      const response = await fetch(`/api/visit-schedules/${cancellingScheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CANCELLED',
          memo: cancellationReason ? `[취소 사유] ${cancellationReason}` : undefined
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: '성공',
          description: '일정이 취소되었습니다.'
        });
        setShowCancelScheduleDialog(false);
        setCancellingScheduleId(null);
        setCancellationReason('');
        fetchCustomer();
      } else {
        throw new Error(result.error || '일정 취소 실패');
      }
    } catch (error) {
      console.error('Error cancelling schedule:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '일정 취소에 실패했습니다.',
        variant: 'destructive'
      });
    }
  };

  // 방문 유형 한글 변환
  const getVisitTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CONSULTATION: '상담',
      CONTRACT: '계약',
      SITE_VISIT: '현장방문',
      FOLLOW_UP: '후속관리'
    };
    return labels[type] || type;
  };

  // 방문 상태 한글 변환 및 색상
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
      SCHEDULED: { label: '예정', color: 'text-blue-700', bgColor: 'bg-blue-100' },
      COMPLETED: { label: '완료', color: 'text-green-700', bgColor: 'bg-green-100' },
      CANCELLED: { label: '취소', color: 'text-red-700', bgColor: 'bg-red-100' },
      NO_SHOW: { label: '노쇼', color: 'text-gray-700', bgColor: 'bg-gray-100' }
    };
    return statusMap[status] || { label: status, color: 'text-gray-700', bgColor: 'bg-gray-100' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">로딩 중...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">고객을 찾을 수 없습니다.</div>
      </div>
    );
  }

  // 수정 모드 렌더링
  if (isEditing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 sm:gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  취소
                </Button>
                <h1 className="text-lg sm:text-2xl font-bold">고객 정보 수정</h1>
              </div>
              <Button onClick={handleSave} disabled={loading} size="sm" className="w-full sm:w-auto">
                <Save className="w-4 h-4 mr-2" />
                저장
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl space-y-4 sm:space-y-6">
          {/* 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">이름</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">전화번호</Label>
                  <Input
                    id="phone"
                    value={formatPhoneDisplay(formData.phone)}
                    onChange={(e) => handleInputChange('phone', e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="memo">메모</Label>
                <Textarea
                  id="memo"
                  value={formData.memo}
                  onChange={(e) => handleInputChange('memo', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>방문 예정일</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.nextVisitDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.nextVisitDate ? (
                          format(formData.nextVisitDate, 'PPP', { locale: ko })
                        ) : (
                          <span>날짜를 선택하세요</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.nextVisitDate}
                        onSelect={(date) => setFormData(prev => ({ ...prev, nextVisitDate: date }))}
                        locale={ko}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="assignedSite">현장명</Label>
                  <Select value={formData.assignedSite} onValueChange={(value) => handleInputChange('assignedSite', value)}>
                    <SelectTrigger id="assignedSite">
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="용인경남아너스빌">용인경남아너스빌</SelectItem>
                      <SelectItem value="신광교클라우드시티">신광교클라우드시티</SelectItem>
                      <SelectItem value="평택로제비앙">평택 로제비앙</SelectItem>
                      <SelectItem value="왕십리어반홈스">왕십리 어반홈스</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 개인 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>개인 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gender">성별</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">남성</SelectItem>
                      <SelectItem value="FEMALE">여성</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ageRange">나이대</Label>
                  <Select value={formData.ageRange} onValueChange={(value) => handleInputChange('ageRange', value)}>
                    <SelectTrigger id="ageRange">
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TWENTIES">20대</SelectItem>
                      <SelectItem value="THIRTIES">30대</SelectItem>
                      <SelectItem value="FORTIES">40대</SelectItem>
                      <SelectItem value="FIFTIES">50대</SelectItem>
                      <SelectItem value="SIXTIES_PLUS">60대 이상</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="residenceArea">거주지역</Label>
                  <Input
                    id="residenceArea"
                    value={formData.residenceArea}
                    onChange={(e) => handleInputChange('residenceArea', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="familyRelation">가족관계</Label>
                  <Input
                    id="familyRelation"
                    value={formData.familyRelation}
                    onChange={(e) => handleInputChange('familyRelation', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="occupation">직업</Label>
                <Input
                  id="occupation"
                  value={formData.occupation}
                  onChange={(e) => handleInputChange('occupation', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* 영업 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>영업 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="source">고객 출처</Label>
                  <Select value={formData.source} onValueChange={(value) => handleInputChange('source', value)}>
                    <SelectTrigger id="source">
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AD">광고</SelectItem>
                      <SelectItem value="TM">TM</SelectItem>
                      <SelectItem value="WALKING">워킹</SelectItem>
                      <SelectItem value="CAR_ORDER">카오더</SelectItem>
                      <SelectItem value="FIELD">필드(거점, 현수막, 행주)</SelectItem>
                      <SelectItem value="REFERRAL">소개</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="grade">고객 등급</Label>
                  <Select value={formData.grade} onValueChange={(value) => handleInputChange('grade', value)}>
                    <SelectTrigger id="grade">
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A등급 (VIP)</SelectItem>
                      <SelectItem value="B">B등급</SelectItem>
                      <SelectItem value="C">C등급</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>투자 성향</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="timeProfit"
                      checked={formData.investmentStyle.timeProfit}
                      onCheckedChange={() => handleInvestmentStyleChange('timeProfit')}
                    />
                    <label htmlFor="timeProfit" className="text-sm">시세차익</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="monthlyIncome"
                      checked={formData.investmentStyle.monthlyIncome}
                      onCheckedChange={() => handleInvestmentStyleChange('monthlyIncome')}
                    />
                    <label htmlFor="monthlyIncome" className="text-sm">월수익</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="residence"
                      checked={formData.investmentStyle.residence}
                      onCheckedChange={() => handleInvestmentStyleChange('residence')}
                    />
                    <label htmlFor="residence" className="text-sm">실거주</label>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="expectedBudget">예상 투자 가능 금액 (만원)</Label>
                <Input
                  id="expectedBudget"
                  type="number"
                  value={formData.expectedBudget}
                  onChange={(e) => handleInputChange('expectedBudget', e.target.value)}
                />
              </div>

              <div>
                <Label>관심 부동산</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="apt"
                      checked={formData.ownedProperties.apt}
                      onCheckedChange={() => handleOwnedPropertiesChange('apt')}
                    />
                    <label htmlFor="apt" className="text-sm">아파트</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="officetel"
                      checked={formData.ownedProperties.officetel}
                      onCheckedChange={() => handleOwnedPropertiesChange('officetel')}
                    />
                    <label htmlFor="officetel" className="text-sm">오피스텔</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="commercial"
                      checked={formData.ownedProperties.commercial}
                      onCheckedChange={() => handleOwnedPropertiesChange('commercial')}
                    />
                    <label htmlFor="commercial" className="text-sm">상가</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="building"
                      checked={formData.ownedProperties.building}
                      onCheckedChange={() => handleOwnedPropertiesChange('building')}
                    />
                    <label htmlFor="building" className="text-sm">빌딩</label>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="recentVisitedMH">최근 방문 모델하우스</Label>
                <Input
                  id="recentVisitedMH"
                  value={formData.recentVisitedMH}
                  onChange={(e) => handleInputChange('recentVisitedMH', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 보기 모드 렌더링
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 - 모바일 최적화 */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* 네비게이션 버튼 */}
          <div className="flex items-center gap-2 mb-2 sm:mb-3 -ml-1 sm:-ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/customers')}
              className="text-gray-500 hover:text-gray-900 text-xs sm:text-sm px-2 sm:px-3"
            >
              <ChevronLeft className="w-4 h-4 mr-0.5 sm:mr-1" />
              <span className="hidden xs:inline">고객 목록</span>
              <span className="xs:hidden">목록</span>
            </Button>

            {navigationData && (
              <div className="flex items-center gap-1 ml-1 sm:ml-2 border-l pl-1 sm:pl-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNavigateCustomer('prev')}
                  disabled={navigationData.currentIndex === 0}
                  title="이전 고객"
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-[10px] sm:text-xs text-gray-500 px-1 sm:px-2 min-w-[50px] text-center">
                  {navigationData.currentIndex + 1} / {navigationData.customerIds.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNavigateCustomer('next')}
                  disabled={navigationData.currentIndex === navigationData.customerIds.length - 1}
                  title="다음 고객"
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* 고객 정보 및 액션 */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {customer.name}
                </h1>
                {customer.grade === 'A' && (
                  <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] sm:text-xs font-bold rounded-full">
                    VIP
                  </span>
                )}
                {customer.isDuplicate && (
                  <span className="px-1.5 sm:px-2 py-0.5 bg-red-100 text-red-700 text-[10px] sm:text-xs font-medium rounded-full">
                    중복
                  </span>
                )}
                {isBlacklisted && (
                  <span className="px-1.5 sm:px-2 py-0.5 bg-black text-white text-[10px] sm:text-xs font-bold rounded-full flex items-center gap-0.5 sm:gap-1">
                    <Ban className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    블랙
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500 flex-wrap">
                <span className="font-medium">{formatPhoneDisplay(customer.phone)}</span>
                {customer.assignedUser && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span>담당: {customer.assignedUser.name}</span>
                  </>
                )}
                {customer.assignedSite && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span>{customer.assignedSite}</span>
                  </>
                )}
              </div>
            </div>

            {/* 액션 버튼 - 모바일에서 가로 스크롤 가능 */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:overflow-visible">
              {/* 블랙리스트 버튼 */}
              {isBlacklisted ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveBlacklist}
                  disabled={blacklistLoading}
                  className="text-gray-600 border-gray-300 hover:bg-gray-50 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 whitespace-nowrap flex-shrink-0"
                >
                  <Ban className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                  <span className="hidden sm:inline">{blacklistLoading ? '처리 중...' : '블랙리스트 해제'}</span>
                  <span className="sm:hidden">{blacklistLoading ? '처리중' : '해제'}</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBlacklistDialog(true)}
                  className="text-red-600 border-red-200 hover:bg-red-50 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 whitespace-nowrap flex-shrink-0"
                >
                  <Ban className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                  <span className="hidden sm:inline">블랙리스트 등록</span>
                  <span className="sm:hidden">블랙등록</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/dashboard/contracts?customerId=${customerId}`)}
                className="text-green-600 border-green-200 hover:bg-green-50 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 whitespace-nowrap flex-shrink-0"
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                계약 대장
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTransferModal(true)}
                className="text-gray-600 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 whitespace-nowrap flex-shrink-0"
              >
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                <span className="hidden sm:inline">담당자 변경</span>
                <span className="sm:hidden">담당변경</span>
              </Button>
              <Button
                onClick={() => setIsEditing(true)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3 whitespace-nowrap flex-shrink-0"
              >
                <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                수정
              </Button>
              {session?.user?.role === 'ADMIN' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 sm:h-9 w-8 sm:w-9 p-0 flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 블랙리스트 경고 배너 */}
      {isBlacklisted && blacklistInfo && (
        <div className="bg-red-600 text-white">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="font-bold text-lg">전화 금지! 블랙리스트 고객입니다</p>
                <p className="text-sm opacity-90">
                  사유: {blacklistInfo.reason}
                  {blacklistInfo.registeredBy && ` (등록: ${blacklistInfo.registeredBy.name})`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl space-y-4 sm:space-y-6">
        {/* 기본 정보 */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-muted-foreground">이름</span>
                  <span className="font-medium">{customer.name}</span>
                </div>
                <div className="flex justify-between items-center text-sm sm:text-base">
                  <span className="text-muted-foreground">전화번호</span>
                  <a
                    href={`tel:${customer.phone}`}
                    className="font-medium text-blue-600 hover:underline flex items-center gap-1.5 sm:gap-2"
                  >
                    <span>{formatPhoneDisplay(customer.phone)}</span>
                    <Phone className="w-4 h-4" />
                  </a>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-muted-foreground">최초 등록일</span>
                  <span className="font-medium text-right">
                    {format(new Date(customer.createdAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                  </span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-muted-foreground">방문 예정일</span>
                  <span className="font-medium">
                    {customer.nextVisitDate ? format(new Date(customer.nextVisitDate), 'yyyy년 MM월 dd일', { locale: ko }) : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-muted-foreground">현장명</span>
                  <span className="font-medium">{customer.assignedSite || '-'}</span>
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {customer.memo && (
                  <div>
                    <div className="text-muted-foreground mb-1 text-sm sm:text-base">메모</div>
                    <div className="text-xs sm:text-sm bg-gray-50 p-2 sm:p-3 rounded leading-relaxed">{customer.memo}</div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 담당자 변경 이력 */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              담당자 변경 이력
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allocationHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 sm:py-8 text-sm sm:text-base">
                담당자 변경 이력이 없습니다.
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {allocationHistory.map((record, index) => (
                  <div key={record.id} className="flex items-start gap-2 sm:gap-3">
                    {/* 타임라인 표시 */}
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${index === 0 ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      {index < allocationHistory.length - 1 && (
                        <div className="w-0.5 h-full bg-gray-200 mt-1" />
                      )}
                    </div>
                    {/* 이력 내용 */}
                    <div className="flex-1 border rounded-lg p-2 sm:p-3 bg-white">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-0 mb-1 sm:mb-2">
                        <div className="font-medium text-xs sm:text-sm">
                          <span className="text-gray-600">{record.from}</span>
                          <span className="mx-1 sm:mx-2 text-gray-400">→</span>
                          <span className="text-blue-600">{record.to}</span>
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">
                          {format(new Date(record.createdAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                        </div>
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500">
                        처리자: {record.allocatedBy}
                        {record.reason && record.reason !== '-' && (
                          <span className="ml-1 sm:ml-2">| 사유: {record.reason}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 통화 기록 */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">통화 기록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {/* 새 통화 기록 입력 */}
            <div className="flex gap-2">
              <Input
                placeholder="통화 내용을 입력하세요..."
                value={newCallLog}
                onChange={(e) => setNewCallLog(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddCallLog();
                  }
                }}
                className="flex-1 text-sm sm:text-base h-9 sm:h-10"
              />
              <Button onClick={handleAddCallLog} disabled={!newCallLog.trim() || addingCallLog} className="h-9 sm:h-10 w-9 sm:w-10 p-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* 통화 기록 리스트 */}
            <div className="space-y-2 sm:space-y-3">
              {callLogs.length === 0 ? (
                <div className="text-center text-muted-foreground py-6 sm:py-8 text-sm sm:text-base">
                  통화 기록이 없습니다.
                </div>
              ) : (
                callLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-2.5 sm:p-4 bg-white">
                    {editingCallLogId === log.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editingCallLogContent}
                          onChange={(e) => setEditingCallLogContent(e.target.value)}
                          className="flex-1 text-sm sm:text-base"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCallLogId(null);
                              setEditingCallLogContent('');
                            }}
                            className="h-7 sm:h-8 text-xs sm:text-sm"
                          >
                            <X className="w-3 h-3 mr-1" />
                            취소
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUpdateCallLog(log.id)}
                            className="h-7 sm:h-8 text-xs sm:text-sm"
                          >
                            <Save className="w-3 h-3 mr-1" />
                            저장
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                          <div className="text-[10px] sm:text-sm text-muted-foreground">
                            {log.user.name} • {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm')}
                          </div>
                          <div className="flex gap-0.5 sm:gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingCallLogId(log.id);
                                setEditingCallLogContent(log.content);
                              }}
                              className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteCallLog(log.id)}
                              className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs sm:text-sm leading-relaxed">{log.content}</div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 개인 정보 */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">개인 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="flex justify-between text-sm sm:text-base py-1 sm:py-0">
                <span className="text-muted-foreground">성별</span>
                <span className="font-medium">
                  {customer.gender === 'MALE' ? '남성' : customer.gender === 'FEMALE' ? '여성' : '-'}
                </span>
              </div>
              <div className="flex justify-between text-sm sm:text-base py-1 sm:py-0">
                <span className="text-muted-foreground">나이대</span>
                <span className="font-medium">
                  {customer.ageRange === 'TWENTIES' ? '20대' :
                   customer.ageRange === 'THIRTIES' ? '30대' :
                   customer.ageRange === 'FORTIES' ? '40대' :
                   customer.ageRange === 'FIFTIES' ? '50대' :
                   customer.ageRange === 'SIXTIES_PLUS' ? '60대 이상' : '-'}
                </span>
              </div>
              <div className="flex justify-between text-sm sm:text-base py-1 sm:py-0">
                <span className="text-muted-foreground">거주지역</span>
                <span className="font-medium">{customer.residenceArea || '-'}</span>
              </div>
              <div className="flex justify-between text-sm sm:text-base py-1 sm:py-0">
                <span className="text-muted-foreground">가족관계</span>
                <span className="font-medium">{customer.familyRelation || '-'}</span>
              </div>
              <div className="flex justify-between text-sm sm:text-base py-1 sm:py-0">
                <span className="text-muted-foreground">직업</span>
                <span className="font-medium">{customer.occupation || '-'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 영업 정보 */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">영업 정보</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            <div className="flex justify-between text-sm sm:text-base py-1 sm:py-0">
              <span className="text-muted-foreground">고객 출처</span>
              <span className="font-medium">
                {customer.source === 'AD' ? '광고' :
                 customer.source === 'TM' ? 'TM' :
                 customer.source === 'WALKING' ? '워킹' :
                 customer.source === 'CAR_ORDER' ? '카오더' :
                 customer.source === 'FIELD' ? '필드(거점, 현수막, 행주)' :
                 customer.source === 'REFERRAL' ? '소개' : '-'}
              </span>
            </div>
            <div className="flex justify-between text-sm sm:text-base py-1 sm:py-0">
              <span className="text-muted-foreground">고객 등급</span>
              <span className="font-medium">{customer.grade}등급</span>
            </div>
            <div className="flex justify-between text-sm sm:text-base py-1 sm:py-0">
              <span className="text-muted-foreground">투자 성향</span>
              <span className="font-medium">{parseInvestmentStyle(customer.investmentStyle)}</span>
            </div>
            <div className="flex justify-between text-sm sm:text-base py-1 sm:py-0">
              <span className="text-muted-foreground">예상 투자금액</span>
              <span className="font-medium">
                {customer.expectedBudget ? `${customer.expectedBudget.toLocaleString()}만원` : '-'}
              </span>
            </div>
            <div className="flex justify-between text-sm sm:text-base py-1 sm:py-0">
              <span className="text-muted-foreground">관심 부동산</span>
              <span className="font-medium">{parseProperties(customer.ownedProperties)}</span>
            </div>
            <div className="flex justify-between text-sm sm:text-base py-1 sm:py-0">
              <span className="text-muted-foreground">최근 방문 MH</span>
              <span className="font-medium">{customer.recentVisitedMH || '-'}</span>
            </div>
          </CardContent>
        </Card>

        {/* 방문 일정 전체 목록 */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg">
                <CalendarLucide className="w-4 h-4 sm:w-5 sm:h-5" />
                방문 일정
              </CardTitle>
              <Button
                size="sm"
                onClick={() => setShowAddScheduleDialog(true)}
                className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                일정 추가
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!customer.visitSchedules || customer.visitSchedules.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 sm:py-8">
                <CalendarLucide className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-300" />
                <p className="text-sm sm:text-base">등록된 방문 일정이 없습니다.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 sm:mt-4 h-8 sm:h-9 text-xs sm:text-sm"
                  onClick={() => setShowAddScheduleDialog(true)}
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                  첫 방문 일정 등록하기
                </Button>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {customer.visitSchedules.map((schedule) => {
                  const statusInfo = getStatusInfo(schedule.status);
                  const isPast = new Date(schedule.visitDate) < new Date();
                  const isScheduled = schedule.status === 'SCHEDULED';

                  return (
                    <div
                      key={schedule.id}
                      className={`border rounded-lg p-2.5 sm:p-4 ${
                        schedule.status === 'CANCELLED' ? 'bg-gray-50 opacity-60' :
                        schedule.status === 'COMPLETED' ? 'bg-green-50' :
                        'bg-white'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full bg-purple-100 text-purple-700">
                              {getVisitTypeLabel(schedule.visitType)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                            <div className="flex items-center gap-1 sm:gap-1.5 text-gray-700">
                              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                              <span className="font-medium">
                                {format(new Date(schedule.visitDate), 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                            <span>{schedule.location}</span>
                          </div>
                        </div>

                        {/* 액션 버튼 - 모바일에서 가로 배치 */}
                        {isScheduled && (
                          <div className="flex items-center gap-1.5 sm:gap-2 sm:ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleScheduleStatusChange(schedule.id, 'COMPLETED')}
                              className="text-green-600 border-green-200 hover:bg-green-50 h-7 sm:h-8 text-[10px] sm:text-xs px-1.5 sm:px-2"
                              title="방문 완료"
                            >
                              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                              완료
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCancellingScheduleId(schedule.id);
                                setShowCancelScheduleDialog(true);
                              }}
                              className="text-red-600 border-red-200 hover:bg-red-50 h-7 sm:h-8 text-[10px] sm:text-xs px-1.5 sm:px-2"
                              title="일정 취소"
                            >
                              <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                              취소
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingSchedule(schedule);
                                setShowAddScheduleDialog(true);
                              }}
                              title="일정 수정"
                              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                            >
                              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                        )}
                        {schedule.status === 'COMPLETED' && (
                          <div className="flex items-center text-green-600 sm:ml-4">
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 담당자 변경 요청 모달 */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>담당자 변경 요청</DialogTitle>
            <DialogDescription>
              {customer?.name}님의 담당자를 변경하도록 요청합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">
                현재 담당자: <strong>{customer?.assignedUser?.name || '미배정'}</strong>
                {customer?.assignedUser?.email && (
                  <span className="text-xs text-gray-500 ml-2">({customer.assignedUser.email})</span>
                )}
              </p>
            </div>

            <div>
              <Label htmlFor="toUserId">변경 대상 담당자</Label>
              <Select
                value={transferData.toUserId}
                onValueChange={(value) => setTransferData(prev => ({ ...prev, toUserId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="담당자를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(u => u.id !== customer?.assignedUserId) // 현재 담당자 제외
                    .map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email}) - {user.role}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="reason">변경 사유</Label>
              <Textarea
                id="reason"
                placeholder="담당자 변경이 필요한 사유를 입력하세요..."
                value={transferData.reason}
                onChange={(e) => setTransferData(prev => ({ ...prev, reason: e.target.value }))}
                rows={4}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowTransferModal(false)}
              disabled={transferLoading}
            >
              취소
            </Button>
            <Button
              onClick={handleTransferRequest}
              disabled={transferLoading || !transferData.toUserId || !transferData.reason.trim()}
            >
              {transferLoading ? '처리 중...' : '요청 등록'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>고객 삭제 확인</DialogTitle>
            <DialogDescription>
              정말로 이 고객을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-sm text-red-800">
                <strong>{customer.name}</strong> 고객의 모든 정보가 영구적으로 삭제됩니다:
              </p>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                <li>기본 정보 및 연락처</li>
                <li>통화 기록</li>
                <li>방문 일정</li>
                <li>관심 카드</li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={loading}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCustomer}
              disabled={loading}
            >
              {loading ? '삭제 중...' : '삭제'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 방문 일정 추가/수정 다이얼로그 */}
      <AddScheduleDialog
        open={showAddScheduleDialog}
        onOpenChange={(open) => {
          setShowAddScheduleDialog(open);
          if (!open) {
            setEditingSchedule(null);
          }
        }}
        onSuccess={() => {
          fetchCustomer();
          setEditingSchedule(null);
        }}
        preselectedDate={new Date()}
        preselectedCustomerId={customerId}
        preselectedCustomerName={customer?.name}
        editingSchedule={editingSchedule ? {
          id: editingSchedule.id,
          customerId: customerId,
          customer: {
            id: customerId,
            name: customer?.name || '',
            phone: customer?.phone || ''
          },
          visitDate: editingSchedule.visitDate,
          visitType: editingSchedule.visitType,
          location: editingSchedule.location,
          memo: ''
        } : null}
      />

      {/* 일정 취소 확인 다이얼로그 */}
      <Dialog open={showCancelScheduleDialog} onOpenChange={setShowCancelScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>방문 일정 취소</DialogTitle>
            <DialogDescription>
              이 방문 일정을 취소하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="cancellationReason">취소 사유 (선택)</Label>
              <Textarea
                id="cancellationReason"
                placeholder="취소 사유를 입력하세요..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelScheduleDialog(false);
                setCancellingScheduleId(null);
                setCancellationReason('');
              }}
            >
              닫기
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSchedule}
            >
              일정 취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 블랙리스트 등록 다이얼로그 */}
      <Dialog open={showBlacklistDialog} onOpenChange={setShowBlacklistDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-600" />
              블랙리스트 등록
            </DialogTitle>
            <DialogDescription>
              이 고객을 블랙리스트에 등록하면 다른 직원들에게도 경고가 표시됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-900">{customer?.name}</p>
                  <p className="text-sm text-red-700">{customer?.phone ? formatPhoneDisplay(customer.phone) : ''}</p>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="blacklistReason">
                블랙리스트 사유 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="blacklistReason"
                placeholder="예: 욕설 및 폭언, 반복적인 민원 제기, 사기 이력 등"
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                rows={4}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                정확한 사유를 입력해주세요. 관리자가 검토할 수 있습니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowBlacklistDialog(false);
                setBlacklistReason('');
              }}
              disabled={blacklistLoading}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleRegisterBlacklist}
              disabled={blacklistLoading || !blacklistReason.trim()}
            >
              <Ban className="w-4 h-4 mr-1.5" />
              {blacklistLoading ? '등록 중...' : '블랙리스트 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
