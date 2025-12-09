'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Copy, Check } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface VisitSchedule {
  id: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  visitDate: string;
  visitType: string;
  location: string;
  memo?: string;
}

interface AddScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preselectedDate?: Date;
  preselectedCustomerId?: string;
  preselectedCustomerName?: string;
  editingSchedule?: VisitSchedule | null;
}

// 카카오 오픈채팅방 URL
const KAKAO_OPENCHAT_URL = 'https://open.kakao.com/o/gPY9bI2h';

export default function AddScheduleDialog({
  open,
  onOpenChange,
  onSuccess,
  preselectedDate,
  preselectedCustomerId,
  preselectedCustomerName,
  editingSchedule,
}: AddScheduleDialogProps) {
  const isEditMode = !!editingSchedule;
  const { toast } = useToast();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 등록 성공 후 표시할 상태
  const [showSuccessActions, setShowSuccessActions] = useState(false);
  const [savedScheduleInfo, setSavedScheduleInfo] = useState<{
    customerName: string;
    customerPhone: string;
    visitDate: Date;
    userName: string;
    userPosition: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state - split date and time for better control
  const getInitialDateTime = () => {
    const date = preselectedDate || new Date();
    // 로컬 시간대 기준으로 날짜 유지
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Round to nearest 30 minutes
    const minutes = date.getMinutes();
    const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 0;
    let hours = date.getHours();
    if (roundedMinutes === 0 && minutes >= 45) {
      hours = hours + 1;
    }

    return {
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${String(hours).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`,
    };
  };

  const { dateStr, timeStr } = getInitialDateTime();

  const [formData, setFormData] = useState({
    customerId: '',
    visitDate: `${dateStr}T${timeStr}`,
    visitType: 'CONSULTATION',
    location: '',
    memo: '',
  });

  const [dateOnly, setDateOnly] = useState(dateStr);
  const [timeOnly, setTimeOnly] = useState(timeStr);

  useEffect(() => {
    if (open) {
      fetchCustomers();

      // 미리 선택된 고객 ID가 있으면 설정
      if (preselectedCustomerId && !editingSchedule) {
        setFormData((prev) => ({ ...prev, customerId: preselectedCustomerId }));
      }

      // 편집 모드일 때 기존 값으로 폼 초기화
      if (editingSchedule) {
        const visitDate = new Date(editingSchedule.visitDate);
        const year = visitDate.getFullYear();
        const month = String(visitDate.getMonth() + 1).padStart(2, '0');
        const day = String(visitDate.getDate()).padStart(2, '0');
        const hours = String(visitDate.getHours()).padStart(2, '0');
        const minutes = String(visitDate.getMinutes()).padStart(2, '0');

        const dateValue = `${year}-${month}-${day}`;
        const timeValue = `${hours}:${minutes}`;

        setDateOnly(dateValue);
        setTimeOnly(timeValue);
        setFormData({
          customerId: editingSchedule.customerId,
          visitDate: `${dateValue}T${timeValue}`,
          visitType: editingSchedule.visitType,
          location: editingSchedule.location,
          memo: editingSchedule.memo || '',
        });
      }
    }
  }, [open, editingSchedule]);

  useEffect(() => {
    if (preselectedDate) {
      const date = new Date(preselectedDate);
      // 로컬 시간대 기준으로 날짜 유지
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      const minutes = date.getMinutes();
      const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 0;
      let hours = date.getHours();
      if (roundedMinutes === 0 && minutes >= 45) {
        hours = hours + 1;
      }

      const newDateOnly = `${year}-${month}-${day}`;
      const newTimeOnly = `${String(hours).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`;
      setDateOnly(newDateOnly);
      setTimeOnly(newTimeOnly);
      setFormData((prev) => ({
        ...prev,
        visitDate: `${newDateOnly}T${newTimeOnly}`,
      }));
    }
  }, [preselectedDate]);

  const fetchCustomers = async (query?: string) => {
    try {
      let url = '/api/customers?limit=100';
      if (query && query.trim()) {
        url += `&query=${encodeURIComponent(query.trim())}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        setCustomers(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  // 검색어 변경 시 서버에서 검색
  useEffect(() => {
    if (open) {
      const timeoutId = setTimeout(() => {
        fetchCustomers(searchQuery);
      }, 300); // 300ms 디바운스
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, open]);

  // 검색어와 일치하는 고객 (클라이언트 필터링은 보조용)
  const filteredCustomers = customers;

  // 방문 예약 텍스트 생성
  const generateVisitText = () => {
    if (!savedScheduleInfo) return '';

    const { customerName, customerPhone, visitDate, userName, userPosition } = savedScheduleInfo;

    // 연락처 마지막 6자리
    const phoneLast6 = customerPhone.replace(/[^0-9]/g, '').slice(-6);
    const formattedPhone = `${phoneLast6.slice(0, 2)}-${phoneLast6.slice(2)}`;

    // 날짜 포맷 (12월 11일 오후 6시 30분)
    const date = new Date(visitDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours < 12 ? '오전' : '오후';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const timeStr = minutes > 0
      ? `${ampm} ${displayHour}시 ${minutes}분`
      : `${ampm} ${displayHour}시`;

    return `온시아
담당자 : ${userName} ${userPosition || '실장'}
고객명 : ${customerName}님
연락처 : ${formattedPhone}
방문예정 : ${month}월 ${day}일 ${timeStr}`;
  };

  // 텍스트 복사
  const handleCopyText = async () => {
    const text = generateVisitText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: '복사 완료',
        description: '방문 예약 텍스트가 클립보드에 복사되었습니다.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: '복사 실패',
        description: '클립보드 복사에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 카카오 오픈채팅 열기
  const handleOpenKakao = () => {
    window.open(KAKAO_OPENCHAT_URL, '_blank');
  };

  // 다이얼로그 닫기 핸들러
  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setShowSuccessActions(false);
      setSavedScheduleInfo(null);
      setCopied(false);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId || !formData.visitDate || !formData.location) {
      toast({
        title: '입력 오류',
        description: '고객, 방문 일시, 장소는 필수입니다.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const url = isEditMode
        ? `/api/visit-schedules/${editingSchedule!.id}`
        : '/api/visit-schedules';

      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // 등록 성공 시 - 성공 화면 표시 (편집 모드가 아닐 때만)
        if (!isEditMode) {
          // 선택된 고객 정보 찾기
          const selectedCustomer = customers.find(c => c.id === formData.customerId);
          const customerName = selectedCustomer?.name || preselectedCustomerName || '고객';
          const customerPhone = selectedCustomer?.phone || '';

          setSavedScheduleInfo({
            customerName,
            customerPhone,
            visitDate: new Date(formData.visitDate),
            userName: session?.user?.name || '담당자',
            userPosition: (session?.user as { position?: string })?.position || '실장',
          });
          setShowSuccessActions(true);
        } else {
          // 편집 모드일 때는 바로 닫기
          toast({
            title: '일정 수정 성공',
            description: '방문 일정이 수정되었습니다.',
          });
          onOpenChange(false);
        }
        onSuccess();
        // Reset form with local timezone
        const now = new Date();
        const resetYear = now.getFullYear();
        const resetMonth = String(now.getMonth() + 1).padStart(2, '0');
        const resetDay = String(now.getDate()).padStart(2, '0');
        const resetHour = String(now.getHours()).padStart(2, '0');
        const resetMinute = String(now.getMinutes()).padStart(2, '0');

        setFormData({
          customerId: '',
          visitDate: `${resetYear}-${resetMonth}-${resetDay}T${resetHour}:${resetMinute}`,
          visitType: 'CONSULTATION',
          location: '',
          memo: '',
        });
        setSearchQuery('');
      } else {
        toast({
          title: isEditMode ? '일정 수정 실패' : '일정 추가 실패',
          description: result.error || (isEditMode ? '일정 수정에 실패했습니다.' : '일정 추가에 실패했습니다.'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to save schedule:', error);
      toast({
        title: '오류',
        description: '서버와의 통신 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {showSuccessActions && savedScheduleInfo ? (
          // 등록 성공 후 화면
          <>
            <DialogHeader>
              <DialogTitle className="text-green-600">✓ 방문 일정 등록 완료</DialogTitle>
              <DialogDescription>
                카카오톡으로 방문 예약 내용을 전달해주세요.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {/* 생성된 텍스트 미리보기 */}
              <div className="p-4 bg-gray-50 rounded-lg border text-sm whitespace-pre-line font-mono">
                {generateVisitText()}
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2">
                <Button
                  onClick={handleCopyText}
                  variant="outline"
                  className="flex-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2 text-green-600" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      텍스트 복사
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleOpenKakao}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  카톡 바로가기
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                텍스트를 복사한 후 카카오톡 오픈채팅방에 붙여넣기 해주세요.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)} variant="outline">
                닫기
              </Button>
            </DialogFooter>
          </>
        ) : (
          // 일정 입력 폼
          <>
            <DialogHeader>
              <DialogTitle>{isEditMode ? '방문 일정 수정' : '방문 일정 추가'}</DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? '방문 일정을 수정합니다. 변경할 정보를 입력해주세요.'
                  : '새로운 방문 일정을 추가합니다. 모든 필수 정보를 입력해주세요.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* 고객 선택 */}
            <div className="grid gap-2">
              <Label htmlFor="customer">
                고객 <span className="text-red-500">*</span>
              </Label>
              {preselectedCustomerId && !isEditMode ? (
                // 고객 상세 페이지에서 열린 경우 - 고객 고정 표시
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {preselectedCustomerName?.charAt(0) || '?'}
                  </div>
                  <span className="font-medium text-blue-900">
                    {preselectedCustomerName || '고객'}
                  </span>
                  <span className="text-xs text-blue-600 ml-auto">자동 선택됨</span>
                </div>
              ) : (
                // 일반적인 경우 - 고객 검색 및 선택
                <>
                  <Input
                    id="customerSearch"
                    placeholder="고객 이름 또는 전화번호 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mb-2"
                  />
                  <Select
                    value={formData.customerId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, customerId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="고객을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} ({customer.phone})
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">
                          {searchQuery
                            ? '검색 결과가 없습니다'
                            : '고객이 없습니다'}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {/* 방문 일시 */}
            <div className="grid gap-2">
              <Label htmlFor="visitDate">
                방문 일시 <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="date" className="text-xs text-muted-foreground">날짜</Label>
                  <Input
                    id="date"
                    type="date"
                    value={dateOnly}
                    onChange={(e) => {
                      setDateOnly(e.target.value);
                      setFormData((prev) => ({ ...prev, visitDate: `${e.target.value}T${timeOnly}` }));
                    }}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="time" className="text-xs text-muted-foreground">시간 (30분 단위)</Label>
                  <select
                    id="time"
                    value={timeOnly}
                    onChange={(e) => {
                      setTimeOnly(e.target.value);
                      setFormData((prev) => ({ ...prev, visitDate: `${dateOnly}T${e.target.value}` }));
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    required
                  >
                    {Array.from({ length: 48 }, (_, i) => {
                      const hour = Math.floor(i / 2);
                      const minute = i % 2 === 0 ? '00' : '30';
                      const timeValue = `${String(hour).padStart(2, '0')}:${minute}`;
                      return (
                        <option key={timeValue} value={timeValue}>
                          {timeValue}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* 방문 유형 */}
            <div className="grid gap-2">
              <Label htmlFor="visitType">방문 유형</Label>
              <Select
                value={formData.visitType}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, visitType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="방문 유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSULTATION">상담</SelectItem>
                  <SelectItem value="CONTRACT">계약</SelectItem>
                  <SelectItem value="SITE_VISIT">현장방문</SelectItem>
                  <SelectItem value="FOLLOW_UP">후속관리</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 현장 선택 */}
            <div className="grid gap-2">
              <Label htmlFor="location">
                방문 현장 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.location}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, location: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="현장을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="용인경남아너스빌">용인경남아너스빌</SelectItem>
                  <SelectItem value="신광교클라우드시티">신광교클라우드시티</SelectItem>
                  <SelectItem value="평택 로제비앙">평택 로제비앙</SelectItem>
                  <SelectItem value="왕십리 어반홈스">왕십리 어반홈스</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 메모 */}
            <div className="grid gap-2">
              <Label htmlFor="memo">메모</Label>
              <Textarea
                id="memo"
                placeholder="추가 메모사항 (선택)"
                value={formData.memo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, memo: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? (isEditMode ? '수정 중...' : '추가 중...')
                : (isEditMode ? '일정 수정' : '일정 추가')}
            </Button>
          </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
