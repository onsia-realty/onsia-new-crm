'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Gift, Users, Phone, Loader2 } from 'lucide-react';
import { SITES } from '@/lib/constants/sites';
import { formatPhone, normalizePhone } from '@/lib/utils/phone';

// 라인별 전화번호 자동 하이픈
// - 한 라인의 숫자가 10/11자리로 "완성"되었을 때만 포맷 (부분 입력 중에는 방해 X)
// - 이미 하이픈이 있어도 다시 정규화 후 포맷해 일관된 형식 유지
function formatPhoneLine(line: string): string {
  // 한 줄 안에 콤마로 여러 번호가 있을 수 있음
  if (line.includes(',')) {
    return line
      .split(',')
      .map((seg, idx, arr) => {
        const formatted = formatPhoneLineCore(seg);
        // 마지막 세그먼트가 아니면 세그먼트 사이 공백 보존
        return idx < arr.length - 1 ? formatted : formatted;
      })
      .join(',');
  }
  return formatPhoneLineCore(line);
}

function formatPhoneLineCore(seg: string): string {
  // 라인 양쪽 공백을 보존하되 본체만 처리 (사용자 입력 흐름 방해 X)
  const match = seg.match(/^(\s*)(.*?)(\s*)$/);
  if (!match) return seg;
  const [, leading, body, trailing] = match;
  if (!body) return seg;
  const digits = body.replace(/[^0-9]/g, '');
  // 8~9자리(02 지역번호 등)는 portion이라 건드리지 않음
  // 10/11자리 완성된 번호일 때만 포맷
  if (digits.length === 10 || digits.length === 11) {
    const normalized = normalizePhone(digits);
    return leading + formatPhone(normalized) + trailing;
  }
  return seg;
}

// 전체 텍스트 포맷 (onBlur fallback용)
function autoFormatPhonesText(text: string): string {
  return text.split('\n').map(formatPhoneLine).join('\n');
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface SiteOption {
  id: string;
  name: string;
}

interface PendingCall {
  id: string;
  phone: string;
  siteName: string | null;
  source: string | null;
  receivedAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekKey: string;
  onSuccess?: () => void;
}

export function AdminAwardDialog({ open, onOpenChange, weekKey, onSuccess }: Props) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [pendingCalls, setPendingCalls] = useState<PendingCall[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);

  // 폼 상태
  // mode: phones = 번호 직접 입력 (자동 AdCallNumber 생성) / pool = 기존 PENDING 풀에서 선택
  const [mode, setMode] = useState<'phones' | 'pool'>('phones');
  const [userId, setUserId] = useState<string>('');
  const [siteName, setSiteName] = useState<string>('__none__');
  const [phonesText, setPhonesText] = useState<string>('');
  const [adMedia, setAdMedia] = useState<string>(''); // 광고매체 (메타광고/네이버 등)
  const [feedback, setFeedback] = useState<string>('');
  const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [rootMode, setRootMode] = useState<'create' | 'history'>('create');
  // 내역 탭 새로고침 트리거 — 배분 등록 시점에 increment
  const [historyRefresh, setHistoryRefresh] = useState(0);

  // 입력된 phonesText를 한 줄씩 파싱 + 정규화 미리보기
  const parsedPhones = phonesText
    .split(/[\n,]/)
    .map((line) => line.replace(/[^0-9]/g, ''))
    .filter((p) => p.length >= 10 && p.length <= 11);
  const uniquePhones = Array.from(new Set(parsedPhones));

  // 직원/현장 목록 로드
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [usersRes, sitesRes] = await Promise.all([
          fetch('/api/users').then((r) => r.json()),
          fetch('/api/sites').then((r) => r.json()),
        ]);
        if (usersRes.success) {
          // EMPLOYEE만 시상 대상
          setUsers(
            (usersRes.data as UserOption[]).filter((u) => u.role === 'EMPLOYEE')
          );
        }
        if (sitesRes.success) setSites(sitesRes.data);
      } catch {
        toast({
          title: '오류',
          description: '직원/현장 목록 로드 실패',
          variant: 'destructive',
        });
      }
    })();
  }, [open, toast]);

  // PENDING 풀 로드 (pool 모드 전환 시)
  useEffect(() => {
    if (!open || mode !== 'pool') return;
    let cancelled = false;
    (async () => {
      setLoadingPool(true);
      try {
        const res = await fetch('/api/ad-calls?status=PENDING');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'PENDING 콜 조회 실패');
        // 응답 형태가 success wrapper 일 수도 있고 직접 배열일 수도 있어 둘 다 대응
        const list = Array.isArray(json) ? json : json.data ?? [];
        if (!cancelled) {
          setPendingCalls(
            (list as PendingCall[]).map((c) => ({
              id: c.id,
              phone: c.phone,
              siteName: c.siteName,
              source: c.source,
              receivedAt: c.receivedAt,
            }))
          );
        }
      } catch (err) {
        toast({
          title: '오류',
          description: err instanceof Error ? err.message : 'PENDING 콜 조회 실패',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoadingPool(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, toast]);

  const reset = () => {
    setUserId('');
    setSiteName('__none__');
    setPhonesText('');
    setAdMedia('');
    setFeedback('');
    setSelectedCallIds(new Set());
    setMode('phones');
  };

  // SITES 상수 + DB sites union (중복 제거, 상수 우선)
  const allSites = (() => {
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    SITES.forEach((name) => {
      out.push({ id: `const-${name}`, name });
      seen.add(name);
    });
    sites.forEach((s) => {
      if (!seen.has(s.name)) {
        out.push(s);
        seen.add(s.name);
      }
    });
    return out;
  })();

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const toggleCall = (id: string) => {
    setSelectedCallIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleSubmit = async () => {
    if (!userId) {
      toast({ title: '입력 확인', description: '직원을 선택해주세요', variant: 'destructive' });
      return;
    }
    const finalCount = mode === 'pool' ? selectedCallIds.size : uniquePhones.length;
    if (!finalCount || finalCount <= 0) {
      toast({
        title: '입력 확인',
        description:
          mode === 'pool'
            ? '광고콜을 1개 이상 선택해주세요'
            : '유효한 전화번호를 1개 이상 입력해주세요 (10~11자리)',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const cleanSite = siteName && siteName !== '__none__' ? siteName : null;
      const body: Record<string, unknown> = {
        userId,
        siteName: cleanSite,
        feedback: feedback.trim() || null,
        weekKey,
      };
      if (mode === 'pool') {
        body.adCallIds = Array.from(selectedCallIds);
      } else {
        body.phones = uniquePhones;
        if (adMedia.trim()) body.source = adMedia.trim();
      }

      const res = await fetch('/api/ad-calls/awards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '시상 등록 실패');

      const userName = users.find((u) => u.id === userId)?.name ?? '직원';
      toast({
        title: '✅ 시상 등록 완료',
        description: `${userName}에게 ${finalCount}콜 지급되었습니다`,
      });
      // 내역 탭으로 전환 — 사용자가 방금 등록한 시상을 바로 볼 수 있게
      setHistoryRefresh((n) => n + 1);
      reset();
      setRootMode('history');
      onSuccess?.();
    } catch (err) {
      toast({
        title: '시상 등록 실패',
        description: err instanceof Error ? err.message : '오류가 발생했습니다',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-amber-600" />
            광고콜 시상 배분
          </DialogTitle>
          <DialogDescription>
            직원에게 콜을 배분하거나 이번 주 시상 내역과 직원 답변을 확인하세요.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={rootMode} onValueChange={(v) => setRootMode(v as 'create' | 'history')}>
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="create">
              <Gift className="h-4 w-4 mr-1" />
              새 배분
            </TabsTrigger>
            <TabsTrigger value="history">
              📋 배분 내역
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4">
          {/* 직원 선택 */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              직원 <span className="text-red-500">*</span>
            </Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="직원 선택" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 현장 선택 */}
          <div className="space-y-1.5">
            <Label>현장 (선택)</Label>
            <Select value={siteName} onValueChange={setSiteName}>
              <SelectTrigger>
                <SelectValue placeholder="현장 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">(미지정)</SelectItem>
                {allSites.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 모드 탭 */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'phones' | 'pool')}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="phones">번호 직접 입력</TabsTrigger>
              <TabsTrigger value="pool">PENDING 풀에서 선택</TabsTrigger>
            </TabsList>

            <TabsContent value="phones" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  <span>전화번호 목록 <span className="text-red-500">*</span></span>
                  <Badge variant="secondary">{uniquePhones.length}건 인식</Badge>
                </Label>
                <Textarea
                  value={phonesText}
                  onChange={(e) => {
                    const ta = e.currentTarget;
                    const oldValue = ta.value;
                    const oldCursor = ta.selectionStart ?? oldValue.length;
                    const formatted = autoFormatPhonesText(oldValue);
                    if (formatted === oldValue) {
                      setPhonesText(oldValue);
                      return;
                    }
                    // 길이 변화량만큼 커서 보정 (포맷이 추가한 하이픈 수만큼 우측 이동)
                    const lenDiff = formatted.length - oldValue.length;
                    setPhonesText(formatted);
                    requestAnimationFrame(() => {
                      const newPos = Math.min(formatted.length, oldCursor + lenDiff);
                      try {
                        ta.setSelectionRange(newPos, newPos);
                      } catch {
                        // Textarea가 unmount된 경우 등 — 무시
                      }
                    });
                  }}
                  onBlur={(e) => {
                    // 안전망: onChange가 놓친 케이스 보정
                    const formatted = autoFormatPhonesText(e.target.value);
                    if (formatted !== e.target.value) setPhonesText(formatted);
                  }}
                  placeholder="010-1234-5678 (한 줄에 하나)&#10;010 9876 5432&#10;01055554444"
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  10~11자리 완성되면 010-1234-5678 형식으로 자동 변환. 줄바꿈 또는 콤마로 구분, 중복 자동 제외.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>광고매체 (선택)</Label>
                <Input
                  value={adMedia}
                  onChange={(e) => setAdMedia(e.target.value)}
                  placeholder="예: 메타광고, 네이버, 카카오"
                />
                <p className="text-xs text-muted-foreground">
                  직원이 카톡 양식 작성 시 자동으로 채워집니다.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="pool" className="pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  PENDING 광고콜 선택
                </Label>
                <Badge variant="secondary">{selectedCallIds.size} / {pendingCalls.length} 선택</Badge>
              </div>
              {loadingPool ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  <Loader2 className="h-4 w-4 inline animate-spin mr-1" />
                  로딩 중...
                </p>
              ) : pendingCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center bg-slate-50 rounded">
                  PENDING 상태의 광고콜이 없습니다.
                </p>
              ) : (
                <div className="border rounded max-h-64 overflow-y-auto divide-y">
                  {pendingCalls.map((c) => {
                    const checked = selectedCallIds.has(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCall(c.id)}
                          className="h-4 w-4"
                        />
                        <span className="font-mono">{c.phone}</span>
                        {c.siteName && (
                          <Badge variant="outline" className="text-xs">{c.siteName}</Badge>
                        )}
                        {c.source && (
                          <span className="text-xs text-muted-foreground">[{c.source}]</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* 피드백 */}
          <div className="space-y-1.5">
            <Label>관리자 피드백 (선택)</Label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="예: 이번 주 1등 보너스. 전환율 집중 부탁."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              직원의 본인 보드에 그대로 노출됩니다.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-amber-600 hover:bg-amber-700">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  등록 중...
                </>
              ) : (
                <>
                  <Gift className="h-4 w-4 mr-1" />
                  시상 등록
                </>
              )}
            </Button>
          </DialogFooter>
          </TabsContent>

          <TabsContent value="history">
            <AwardHistoryView weekKey={weekKey} refreshSignal={historyRefresh} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 시상 배분 내역 뷰 (이번 주 시상 목록 + 직원 코멘트 미답변 표시 + 답변)
// ─────────────────────────────────────────────────────────────────────

interface HistoryAwardCall {
  id: string;
  phone: string;
  source: string | null;
  status: 'PENDING' | 'ASSIGNED' | 'CONVERTED' | 'INVALID';
  siteName: string | null;
}

interface HistoryAward {
  id: string;
  userId: string;
  userName: string;
  department: string | null;
  siteName: string | null;
  count: number;
  feedback: string | null;
  awardedByName: string;
  createdAt: string;
  commentCount: number;
  staffCommentCount: number;
  hasUnrepliedStaffComment: boolean;
  lastStaffCommentText: string | null;
  lastAdminCommentText: string | null;
  calls: HistoryAwardCall[];
}

interface HistoryComment {
  id: string;
  content: string;
  isStaff: boolean;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
}

function AwardHistoryView({
  weekKey,
  refreshSignal,
}: {
  weekKey: string;
  refreshSignal: number;
}) {
  const { toast } = useToast();
  const [awards, setAwards] = useState<HistoryAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ad-calls/awards?week=${encodeURIComponent(weekKey)}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '내역 조회 실패');
      setAwards(json.data.awards as HistoryAward[]);
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '내역 조회 실패',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [weekKey, toast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshSignal]);

  // 직원별 그룹핑
  const byUser = (() => {
    const map = new Map<string, { userName: string; department: string | null; rows: HistoryAward[] }>();
    for (const a of awards) {
      if (!map.has(a.userId)) {
        map.set(a.userId, { userName: a.userName, department: a.department, rows: [] });
      }
      map.get(a.userId)!.rows.push(a);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const aTotal = a[1].rows.reduce((s, r) => s + r.count, 0);
      const bTotal = b[1].rows.reduce((s, r) => s + r.count, 0);
      return bTotal - aTotal;
    });
  })();

  if (loading && awards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        <Loader2 className="h-4 w-4 inline animate-spin mr-1" />
        로딩 중...
      </p>
    );
  }

  if (awards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center bg-slate-50 rounded">
        이 주에 등록된 시상이 없습니다.
      </p>
    );
  }

  const totalAwards = awards.length;
  const totalCount = awards.reduce((s, a) => s + a.count, 0);

  return (
    <div className="space-y-3">
      {/* 요약 */}
      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <span className="text-sm text-amber-900">
          이번 주 총 <strong>{totalAwards}</strong>건 시상 / <strong>{totalCount}</strong>콜 배분
        </span>
        <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={loading}>
          <Loader2 className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
          새로고침
        </Button>
      </div>

      {/* 직원별 시상 카드 */}
      <div className="space-y-3">
        {byUser.map(([uid, group]) => {
          const groupTotal = group.rows.reduce((s, r) => s + r.count, 0);
          const groupHasUnreplied = group.rows.some((r) => r.hasUnrepliedStaffComment);
          return (
            <div key={uid} className="border rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{group.userName}</span>
                  {group.department && (
                    <span className="text-xs text-slate-500">{group.department}</span>
                  )}
                  {groupHasUnreplied && (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full border border-green-300"
                      title="직원이 답변/문의를 남겼습니다"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      미확인 답변
                    </span>
                  )}
                </div>
                <Badge variant="secondary">+{groupTotal}콜 / {group.rows.length}건</Badge>
              </div>
              <div className="divide-y">
                {group.rows.map((a) => {
                  const isOpen = expandedId === a.id;
                  return (
                    <div key={a.id} className="bg-white">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : a.id)}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 flex flex-col gap-1"
                      >
                        {/* 1행: 메타 정보 */}
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <Badge className="bg-emerald-600 hover:bg-emerald-700">+{a.count}콜</Badge>
                            {a.siteName && <Badge variant="outline">{a.siteName}</Badge>}
                            <span className="text-xs text-slate-500">
                              {new Date(a.createdAt).toLocaleString('ko-KR')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {a.hasUnrepliedStaffComment && (
                              <span
                                className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"
                                title="직원이 답변을 남겼습니다 (미확인)"
                              />
                            )}
                            {a.commentCount > 0 && (
                              <Badge variant="secondary" className="text-[10px]">
                                <MessageCircleIcon /> {a.commentCount}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* 2행: 관리자 피드백 (시상 등록 시) */}
                        {a.feedback && (
                          <div className="text-xs text-amber-700 truncate max-w-full pl-1">
                            <span className="font-medium">💬 관리자:</span> {a.feedback}
                          </div>
                        )}

                        {/* 3행: 직원 마지막 답변 미리보기 — 직원 코멘트 있을 때만 */}
                        {a.lastStaffCommentText && (
                          <div
                            className={cn(
                              'text-xs truncate max-w-full pl-1 rounded',
                              a.hasUnrepliedStaffComment
                                ? 'text-green-800 bg-green-50 border border-green-200 px-1.5 py-0.5 font-medium'
                                : 'text-blue-700'
                            )}
                          >
                            <span className="font-semibold">💭 {a.userName}:</span> {a.lastStaffCommentText}
                            {a.staffCommentCount > 1 && (
                              <span className="ml-1 text-[10px] opacity-70">(+{a.staffCommentCount - 1}개 더)</span>
                            )}
                          </div>
                        )}

                        {/* 4행: 관리자가 답변한 경우 미리보기 — 옵션 */}
                        {a.lastAdminCommentText && !a.hasUnrepliedStaffComment && (
                          <div className="text-xs text-amber-800 truncate max-w-full pl-1">
                            <span className="font-semibold">↩ 답변:</span> {a.lastAdminCommentText}
                          </div>
                        )}
                      </button>
                      {isOpen && (
                        <div className="border-t bg-white">
                          <AwardCallsList calls={a.calls} totalCount={a.count} />
                          <HistoryCommentsBlock awardId={a.id} onUpdated={fetchHistory} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 시상별 콜 번호 + 광고매체 리스트
function AwardCallsList({ calls, totalCount }: { calls: HistoryAwardCall[]; totalCount: number }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  if (calls.length === 0) {
    // 수량만 기록된 시상 (개별 번호 없음)
    if (totalCount > 0) {
      return (
        <div className="px-3 py-2.5 bg-slate-50 border-b text-xs text-slate-600 italic">
          ※ 수량만 기록된 시상으로 개별 번호는 없습니다 ({totalCount}콜).
        </div>
      );
    }
    return null;
  }

  // 광고매체별 그룹화
  const bySource = (() => {
    const map = new Map<string, HistoryAwardCall[]>();
    for (const c of calls) {
      const key = c.source || '(미지정)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries());
  })();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(text);
        toast({ title: '복사됨', description: text });
        setTimeout(() => setCopied(null), 1500);
      },
      () => {
        toast({ title: '복사 실패', variant: 'destructive' });
      }
    );
  };

  const handleCopyAll = () => {
    const all = calls.map((c) => formatPhone(c.phone)).join('\n');
    navigator.clipboard.writeText(all).then(
      () => toast({ title: '전체 복사됨', description: `${calls.length}개 번호` }),
      () => toast({ title: '복사 실패', variant: 'destructive' })
    );
  };

  const statusLabel = (s: HistoryAwardCall['status']) => {
    switch (s) {
      case 'CONVERTED':
        return { text: '전환', cls: 'bg-green-100 text-green-700 border-green-300' };
      case 'ASSIGNED':
        return { text: '미등록', cls: 'bg-blue-50 text-blue-700 border-blue-300' };
      case 'INVALID':
        return { text: '무효', cls: 'bg-red-50 text-red-700 border-red-300' };
      default:
        return { text: '대기', cls: 'bg-slate-100 text-slate-600 border-slate-300' };
    }
  };

  return (
    <div className="px-3 py-3 bg-slate-50 border-b">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-700">
          📞 배분된 번호 <Badge variant="secondary" className="ml-1">{calls.length}개</Badge>
        </span>
        <Button variant="outline" size="sm" onClick={handleCopyAll} className="h-7 text-xs">
          전체 복사
        </Button>
      </div>

      <div className="space-y-2">
        {bySource.map(([source, list]) => (
          <div key={source} className="bg-white border rounded-md overflow-hidden">
            <div className="px-2.5 py-1.5 bg-slate-100 border-b flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                광고매체: {source}
              </span>
              <span className="text-[10px] text-slate-500">{list.length}개</span>
            </div>
            <div className="divide-y max-h-48 overflow-y-auto">
              {list.map((c) => {
                const st = statusLabel(c.status);
                const formatted = formatPhone(c.phone);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 hover:bg-slate-50 text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => handleCopy(formatted)}
                      className="font-mono text-slate-800 hover:text-blue-600 hover:underline cursor-pointer text-left"
                      title="클릭해서 복사"
                    >
                      {formatted}
                      {copied === formatted && (
                        <span className="ml-1.5 text-[10px] text-green-600">✓ 복사됨</span>
                      )}
                    </button>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', st.cls)}>
                      {st.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 작은 lucide 아이콘 인라인 사용
function MessageCircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block mr-0.5"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

// 관리자가 시상별 코멘트를 보고 답변하는 영역
function HistoryCommentsBlock({
  awardId,
  onUpdated,
}: {
  awardId: string;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [comments, setComments] = useState<HistoryComment[] | null>(null);
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
      if (!res.ok || !json.success) throw new Error(json.error || '답변 등록 실패');
      setContent('');
      await fetchComments();
      onUpdated();
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '답변 등록 실패',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-3 py-3 bg-slate-50 border-t">
      {loading && comments === null ? (
        <p className="text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
          코멘트 로딩 중...
        </p>
      ) : comments && comments.length > 0 ? (
        <div className="space-y-2 mb-3 max-h-56 overflow-y-auto">
          {comments.map((c) => (
            <div
              key={c.id}
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                c.isStaff
                  ? 'bg-blue-50 border border-blue-200 mr-6'
                  : 'bg-amber-50 border border-amber-200 ml-6'
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn('text-xs font-medium', c.isStaff ? 'text-blue-700' : 'text-amber-700')}>
                  {c.isStaff ? `${c.authorName} (직원)` : '내 답변 (관리자)'}
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
        <p className="text-xs text-muted-foreground italic mb-3">아직 대화가 없습니다.</p>
      )}

      <div className="space-y-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="직원에게 답변/지시/격려를 남기세요"
          rows={2}
          className="text-sm"
          disabled={submitting}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
            답변 보내기
          </Button>
        </div>
      </div>
    </div>
  );
}
