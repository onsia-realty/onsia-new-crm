'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeftCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReclaimCustomersDialogProps {
  userId: string;
  userName: string;
  customerCount: number;
  onSuccess: () => void;
}

export function ReclaimCustomersDialog({
  userId,
  userName,
  customerCount,
  onSuccess,
}: ReclaimCustomersDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReclaim = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/admin/reclaim-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: userId,
          reclaimAll: true, // 전체 회수
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'DB 회수에 실패했습니다.');
      }

      toast({
        title: 'DB 회수 완료',
        description: result.message,
      });

      setIsOpen(false);
      onSuccess(); // 통계 새로고침
    } catch (error) {
      console.error('Error reclaiming customers:', error);
      toast({
        title: 'DB 회수 실패',
        description: error instanceof Error ? error.message : 'DB 회수 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (customerCount === 0) {
    return null; // 고객이 없으면 버튼 숨김
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-orange-400 text-orange-600 hover:bg-orange-50"
          onClick={(e) => {
            e.stopPropagation(); // 카드 클릭 이벤트 방지
          }}
        >
          <ArrowLeftCircle className="h-4 w-4 mr-1" />
          DB 회수
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ArrowLeftCircle className="h-5 w-5 text-orange-600" />
            DB 회수 확인
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-3 pt-2">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="font-semibold text-orange-900 mb-2">회수 대상</p>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-gray-600">담당자:</span>{' '}
                <span className="font-bold text-gray-900">{userName}</span>
              </p>
              <p>
                <span className="text-gray-600">고객 수:</span>{' '}
                <span className="font-bold text-orange-600">{customerCount}명</span>
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">⚠️ 주의사항</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>모든 고객이 <strong className="text-orange-600">관리자 DB</strong>로 이동됩니다</li>
              <li>담당자의 DB가 <strong className="text-red-600">0건</strong>이 됩니다</li>
              <li>이동 이력은 <strong>영구 보관</strong>되며 삭제되지 않습니다</li>
              <li>고객 상세 페이지에서 이력 확인 가능합니다</li>
            </ul>
          </div>

          <p className="text-sm font-medium text-gray-900">
            정말로 <span className="text-orange-600 font-bold">{userName}</span>님의 DB {customerCount}건을
            회수하시겠습니까?
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleReclaim();
            }}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                회수 중...
              </>
            ) : (
              '회수하기'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
