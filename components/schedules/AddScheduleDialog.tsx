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

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface AddScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preselectedDate?: Date;
}

export default function AddScheduleDialog({
  open,
  onOpenChange,
  onSuccess,
  preselectedDate,
}: AddScheduleDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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
    }
  }, [open]);

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

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers?limit=100');
      if (response.ok) {
        const result = await response.json();
        setCustomers(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery)
  );

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
      const response = await fetch('/api/visit-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: '일정 추가 성공',
          description: '방문 일정이 추가되었습니다.',
        });
        onOpenChange(false);
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
          title: '일정 추가 실패',
          description: result.error || '일정 추가에 실패했습니다.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to add schedule:', error);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>방문 일정 추가</DialogTitle>
          <DialogDescription>
            새로운 방문 일정을 추가합니다. 모든 필수 정보를 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* 고객 선택 */}
            <div className="grid gap-2">
              <Label htmlFor="customer">
                고객 <span className="text-red-500">*</span>
              </Label>
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
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '추가 중...' : '일정 추가'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
