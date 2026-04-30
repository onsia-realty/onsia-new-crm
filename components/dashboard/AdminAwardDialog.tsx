'use client';

import { useEffect, useState } from 'react';
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
      handleClose(false);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-amber-600" />
            광고콜 시상 배분
          </DialogTitle>
          <DialogDescription>
            직원에게 광고콜을 배분하고 피드백을 남기세요. 즉석 입력 또는 PENDING 풀에서 선택 가능합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                  onChange={(e) => setPhonesText(e.target.value)}
                  placeholder="010-1234-5678 (한 줄에 하나)&#10;010 9876 5432&#10;01055554444"
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  하이픈/공백 자동 제거. 줄바꿈 또는 콤마로 구분. 중복 자동 제외.
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
      </DialogContent>
    </Dialog>
  );
}
