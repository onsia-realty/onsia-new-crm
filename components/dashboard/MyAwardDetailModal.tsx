'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Phone,
  CheckCircle2,
  Loader2,
  UserPlus,
  Shield,
  Eye,
  MessageCircle,
  Send,
} from 'lucide-react';
import { formatPhone } from '@/lib/utils/phone';
import { cn } from '@/lib/utils';
import { ConvertCallForm } from './ConvertCallForm';

interface CustomerView {
  id: string;
  name: string | null;
  gender: string | null;
  ageRange: string | null;
  residenceArea: string | null;
  memo: string | null;
  nextVisitDate: string | null;
  assignedSite: string | null;
  grade: string | null;
}

interface CallItem {
  id: string;
  phone: string;
  siteName: string | null;
  source: string | null;
  status: 'PENDING' | 'ASSIGNED' | 'CONVERTED' | 'INVALID';
  convertedToCustomerId: string | null;
  assignedAt: string | null;
  customer: CustomerView | null;
}

interface AwardItem {
  awardId: string;
  siteName: string | null;
  count: number;
  feedback: string | null;
  awardedByName: string;
  awardedAt: string;
  calls: CallItem[];
}

interface MyAwardData {
  weekKey: string;
  weekLabel: string;
  totalCount: number;
  awardCount: number;
  sites: Array<{ name: string; count: number; latestAt: string }>;
  awards: AwardItem[];
}

interface CommentItem {
  id: string;
  content: string;
  isStaff: boolean;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
}

// 시상 카드별 코멘트 영역 — 직원이 답변 코멘트를 작성하고, 관리자/직원 양방향 대화를 표시
function AwardCommentsBlock({ awardId }: { awardId: string }) {
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ad-calls/awards/${awardId}/comments`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '코멘트 조회 실패');
      setComments(json.data);
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '코멘트 조회 실패',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [awardId, toast]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ad-calls/awards/${awardId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '코멘트 등록 실패');
      setContent('');
      await fetchComments();
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '코멘트 등록 실패',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-3 py-3 bg-slate-50 border-t">
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle className="h-4 w-4 text-slate-600" />
        <span className="text-sm font-medium text-slate-700">관리자와 대화</span>
        {comments && comments.length > 0 && (
          <Badge variant="secondary" className="text-xs">{comments.length}개</Badge>
        )}
      </div>

      {/* 코멘트 리스트 */}
      {loading && comments === null ? (
        <p className="text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
          로딩 중...
        </p>
      ) : comments && comments.length > 0 ? (
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          {comments.map((c) => (
            <div
              key={c.id}
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                c.isStaff
                  ? 'bg-blue-50 border border-blue-200 ml-6'
                  : 'bg-amber-50 border border-amber-200 mr-6'
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn(
                  'text-xs font-medium',
                  c.isStaff ? 'text-blue-700' : 'text-amber-700'
                )}>
                  {c.isStaff ? '내 답변' : `${c.authorName} (관리자)`}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString('ko-KR')}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-slate-800">{c.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic mb-3">
          아직 대화가 없습니다. 관리자에게 답변/질문을 남겨보세요.
        </p>
      )}

      {/* 입력 */}
      <div className="space-y-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="관리자에게 답변/보고/질문을 남기세요"
          rows={2}
          className="text-sm"
          disabled={submitting}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1" />
            )}
            답변 보내기
          </Button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekKey: string;
  weekLabel: string;
}

export function MyAwardDetailModal({ open, onOpenChange, weekKey, weekLabel }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<MyAwardData | null>(null);
  const [loading, setLoading] = useState(false);
  // 폼 expand 상태 (callId)
  const [openFor, setOpenFor] = useState<string | null>(null);
  // CONVERTED 콜의 수정 모드 (callId 집합)
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ad-calls/awards/me?week=${weekKey}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '조회 실패');
      setData(json.data);
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '내 시상 조회 실패',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [weekKey, toast]);

  useEffect(() => {
    if (!open) return;
    fetchData();
  }, [open, fetchData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-amber-600" />
            내 광고콜 시상 상세 ({weekLabel})
          </DialogTitle>
          <DialogDescription>
            받은 콜을 클릭해 카톡 양식으로 내 고객 DB에 등록하세요. 등록된 콜은 채운 양식을 다시 볼 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            <Loader2 className="h-4 w-4 inline animate-spin mr-1" />
            로딩 중...
          </p>
        ) : !data || data.totalCount === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            이 주에 받은 광고콜이 없습니다.
          </p>
        ) : (
          <div className="space-y-4">
            {/* 총 지급 한 줄 요약 */}
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-100 to-orange-100 rounded-lg px-4 py-3">
              <div>
                <p className="text-xs text-amber-800">총 지급</p>
                <p className="text-3xl font-extrabold text-amber-900">
                  {data.totalCount}
                  <span className="text-base ml-1 font-medium">콜</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 max-w-[60%] justify-end">
                {data.sites.map((s) => (
                  <Badge key={s.name} variant="secondary">
                    {s.name} +{s.count}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 시상별 카드 */}
            <div className="space-y-3">
              {data.awards.map((award) => (
                <div
                  key={award.awardId}
                  className="border-2 border-amber-200 rounded-lg overflow-hidden bg-white"
                >
                  {/* 시상 헤더 */}
                  <div className="bg-amber-50 p-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-emerald-600 hover:bg-emerald-700">+{award.count}콜</Badge>
                      {award.siteName && (
                        <Badge variant="outline">🔷️ {award.siteName}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {award.awardedByName} · {new Date(award.awardedAt).toLocaleString('ko-KR')}
                      </span>
                    </div>
                  </div>

                  {/* 관리자 피드백 */}
                  {award.feedback && (
                    <div className="px-3 py-2 bg-amber-50/50 border-b">
                      <div className="flex items-start gap-2">
                        <Shield className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium text-amber-900">관리자 피드백 — </span>
                          <span className="whitespace-pre-wrap">{award.feedback}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 받은 콜 리스트 */}
                  {award.calls.length > 0 ? (
                    <div className="divide-y">
                      {award.calls.map((call) => {
                        const isConverted = call.status === 'CONVERTED';
                        const isInvalid = call.status === 'INVALID';
                        const clickable = !isInvalid; // CONVERTED도 보기 모드로 클릭 가능
                        const isOpen = openFor === call.id;
                        return (
                          <div key={call.id} className="hover:bg-slate-50">
                            <button
                              type="button"
                              disabled={!clickable}
                              onClick={() => {
                                if (!clickable) return;
                                setOpenFor(isOpen ? null : call.id);
                              }}
                              className={cn(
                                'w-full text-left p-3 flex items-center justify-between gap-2 flex-wrap',
                                clickable && 'cursor-pointer'
                              )}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <Phone className="h-4 w-4 text-slate-400" />
                                <span className="font-mono font-medium">
                                  {formatPhone(call.phone)}
                                </span>
                                {call.source && (
                                  <Badge variant="outline" className="text-xs">
                                    {call.source}
                                  </Badge>
                                )}
                                {isConverted && call.customer?.name && (
                                  <Badge className="bg-green-600">
                                    <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                    {call.customer.name}
                                  </Badge>
                                )}
                                {isInvalid && <Badge variant="destructive">무효</Badge>}
                                {!isConverted && !isInvalid && (
                                  <Badge variant="outline" className="text-blue-700 border-blue-300">
                                    미등록
                                  </Badge>
                                )}
                              </div>
                              {clickable && (
                                <span
                                  className={cn(
                                    'text-xs inline-flex items-center gap-1',
                                    isConverted ? 'text-green-700' : 'text-blue-600'
                                  )}
                                >
                                  {isConverted ? (
                                    <>
                                      <Eye className="h-3.5 w-3.5" />
                                      {isOpen ? '닫기' : '양식 보기'}
                                    </>
                                  ) : (
                                    <>
                                      <UserPlus className="h-3.5 w-3.5" />
                                      {isOpen ? '닫기' : '카톡 양식 채우기'}
                                    </>
                                  )}
                                </span>
                              )}
                            </button>

                            {/* 카톡 양식 폼 — 등록(create) / 보기(view) / 수정(edit) */}
                            {isOpen && clickable && (
                              <div className="px-3 pb-3">
                                <ConvertCallForm
                                  callId={call.id}
                                  phone={call.phone}
                                  defaultSite={
                                    call.customer?.assignedSite ||
                                    call.siteName ||
                                    award.siteName ||
                                    ''
                                  }
                                  defaultAdMedia={call.source}
                                  readOnly={isConverted && !editingIds.has(call.id)}
                                  customerId={
                                    isConverted && call.customer ? call.customer.id : undefined
                                  }
                                  onEditClick={
                                    isConverted
                                      ? () =>
                                          setEditingIds((prev) => {
                                            const n = new Set(prev);
                                            n.add(call.id);
                                            return n;
                                          })
                                      : undefined
                                  }
                                  initialValues={
                                    isConverted && call.customer
                                      ? {
                                          name: call.customer.name,
                                          gender: call.customer.gender,
                                          ageRange: call.customer.ageRange,
                                          residenceArea: call.customer.residenceArea,
                                          memo: call.customer.memo,
                                          visitDate: call.customer.nextVisitDate,
                                          grade: call.customer.grade,
                                        }
                                      : undefined
                                  }
                                  onCancel={() => {
                                    // 수정 모드면 보기 모드로 복귀, 아니면 폼 닫기
                                    if (editingIds.has(call.id)) {
                                      setEditingIds((prev) => {
                                        const n = new Set(prev);
                                        n.delete(call.id);
                                        return n;
                                      });
                                    } else {
                                      setOpenFor(null);
                                    }
                                  }}
                                  onSuccess={() => {
                                    setEditingIds((prev) => {
                                      const n = new Set(prev);
                                      n.delete(call.id);
                                      return n;
                                    });
                                    setOpenFor(null);
                                    fetchData();
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic px-3 py-2 bg-slate-50">
                      ※ 수량만 기록된 시상으로 개별 콜이 없습니다.
                    </p>
                  )}

                  {/* 관리자와의 대화 (직원 ↔ 관리자 양방향) */}
                  <AwardCommentsBlock awardId={award.awardId} />
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
