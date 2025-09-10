'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Phone, Clock, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CallLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  onSuccess?: () => void;
}

export function CallLogModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  onSuccess,
}: CallLogModalProps) {
  const [callType, setCallType] = useState<'INBOUND' | 'OUTBOUND'>('OUTBOUND');
  const [duration, setDuration] = useState('');
  const [result, setResult] = useState('');
  const [comment, setComment] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!comment.trim()) {
      toast({
        title: '오류',
        description: '통화 내용을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/call-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          callType,
          duration: duration ? parseInt(duration) : null,
          result,
          comment,
          nextAction,
        }),
      });

      if (!response.ok) throw new Error('Failed to save call log');

      toast({
        title: '성공',
        description: '통화 기록이 저장되었습니다.',
      });

      // 초기화
      setCallType('OUTBOUND');
      setDuration('');
      setResult('');
      setComment('');
      setNextAction('');
      onClose();
      onSuccess?.();
    } catch (error) {
      toast({
        title: '오류',
        description: '통화 기록 저장에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>통화 기록 추가</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>고객명</Label>
            <p className="text-sm text-gray-600">{customerName}</p>
          </div>

          <div>
            <Label>통화 유형</Label>
            <RadioGroup value={callType} onValueChange={(v) => setCallType(v as 'INBOUND' | 'OUTBOUND')}>
              <div className="flex space-x-4 mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="OUTBOUND" id="outbound" />
                  <Label htmlFor="outbound">발신</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="INBOUND" id="inbound" />
                  <Label htmlFor="inbound">수신</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>통화 시간 (초)</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="number"
                placeholder="예: 180"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label>통화 결과</Label>
            <Select value={result} onValueChange={setResult}>
              <SelectTrigger>
                <SelectValue placeholder="통화 결과를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="상담 완료">상담 완료</SelectItem>
                <SelectItem value="재통화 필요">재통화 필요</SelectItem>
                <SelectItem value="부재중">부재중</SelectItem>
                <SelectItem value="통화 거부">통화 거부</SelectItem>
                <SelectItem value="계약 진행">계약 진행</SelectItem>
                <SelectItem value="관심 없음">관심 없음</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>통화 내용 <span className="text-red-500">*</span></Label>
            <Textarea
              placeholder="통화 내용을 상세히 기록해주세요..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <Label>후속 조치</Label>
            <Textarea
              placeholder="필요한 후속 조치를 입력하세요 (선택)"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}