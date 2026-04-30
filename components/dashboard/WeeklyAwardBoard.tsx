'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Phone, RefreshCw, ChevronLeft, ChevronRight, Gift, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MyAwardDetailModal } from './MyAwardDetailModal';
import { AdminAwardDialog } from './AdminAwardDialog';

interface AwardRow {
  rank: number;
  userId: string;
  userName: string;
  department: string | null;
  totalCount: number;
  conversionRate: number | null;
  isMe: boolean;
}

interface WeeklyAwardData {
  weekKey: string;
  weekLabel: string;
  rankings: AwardRow[];
  totalAwarded: number;
}

function getCurrentWeekKey(): string {
  const now = new Date();
  // ISO week (월요일 시작)
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function shiftWeek(weekKey: string, offset: number): string {
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return weekKey;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const target = new Date(week1Mon);
  target.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7 + offset * 7);
  // 다시 주차 계산
  const td = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
  const tDay = td.getUTCDay() || 7;
  td.setUTCDate(td.getUTCDate() + 4 - tDay);
  const tStart = new Date(Date.UTC(td.getUTCFullYear(), 0, 1));
  const tWeek = Math.ceil(((td.getTime() - tStart.getTime()) / 86400000 + 1) / 7);
  return `${td.getUTCFullYear()}-W${String(tWeek).padStart(2, '0')}`;
}

export function WeeklyAwardBoard() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [weekKey, setWeekKey] = useState<string>(getCurrentWeekKey());
  const [data, setData] = useState<WeeklyAwardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'HEAD';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ad-calls/awards/weekly?week=${weekKey}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '시상 보드 조회 실패');
      setData(json.data);
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '시상 보드 조회 실패',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [weekKey, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const top3 = data?.rankings.slice(0, 3) ?? [];
  const rest = data?.rankings.slice(3) ?? [];
  const maxCount = data?.rankings[0]?.totalCount ?? 1;
  const isCurrentWeek = weekKey === getCurrentWeekKey();

  const handleCardClick = (row: AwardRow) => {
    if (!row.isMe) return; // 본인 카드만 클릭 가능
    setDetailOpen(true);
  };

  return (
    <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Phone className="h-6 w-6 text-amber-600" />
              📞 콜 시상 보드
            </CardTitle>
            <CardDescription className="mt-1">
              {data?.weekLabel ?? '이번 주'} · 총 {data?.totalAwarded ?? 0}콜 지급
              <span className="block text-xs mt-0.5">
                ※ 일 많이 한 직원이 더 많은 광고콜을 받습니다. 본인 카드만 상세 확인 가능.
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setWeekKey(shiftWeek(weekKey, -1))}
                className="px-2 py-1.5 hover:bg-gray-50"
                aria-label="이전 주"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1.5 text-sm border-x font-medium min-w-[6rem] text-center">
                {data?.weekLabel ?? weekKey}
              </span>
              <button
                type="button"
                onClick={() => setWeekKey(shiftWeek(weekKey, 1))}
                disabled={isCurrentWeek}
                className="px-2 py-1.5 hover:bg-gray-50 disabled:opacity-30"
                aria-label="다음 주"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => setAdminDialogOpen(true)}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Gift className="h-4 w-4 mr-1" />
                시상 배분
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading && !data ? (
          <p className="text-sm text-muted-foreground py-8 text-center">로딩 중...</p>
        ) : !data?.rankings.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            아직 이 주에 지급된 광고콜이 없습니다.
            {isAdmin && ' "시상 배분" 버튼으로 첫 시상을 등록해보세요.'}
          </p>
        ) : (
          <div className="space-y-6">
            {/* TOP 3 메달 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {top3.map((row, i) => {
                const medals = ['🥇', '🥈', '🥉'];
                const gradients = [
                  'from-yellow-400 to-amber-600',
                  'from-slate-300 to-slate-500',
                  'from-orange-400 to-orange-700',
                ];
                const isClickable = row.isMe;
                return (
                  <button
                    key={row.userId}
                    type="button"
                    onClick={() => handleCardClick(row)}
                    disabled={!isClickable}
                    className={cn(
                      'rounded-lg bg-gradient-to-br text-white p-4 text-left transition-all',
                      gradients[i],
                      isClickable
                        ? 'cursor-pointer hover:scale-[1.03] hover:shadow-xl ring-2 ring-amber-400 ring-offset-2'
                        : 'cursor-default opacity-95',
                      i === 0 && 'sm:scale-105 shadow-lg'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="text-4xl leading-none">{medals[i]}</div>
                      {isClickable && (
                        <Badge className="bg-white/20 text-white border-0 text-[10px]">
                          내 보드
                        </Badge>
                      )}
                      {!isClickable && (
                        <Lock className="h-4 w-4 opacity-60" />
                      )}
                    </div>
                    <p className="mt-2 text-xl font-bold">{row.userName}</p>
                    {row.department && (
                      <p className="text-xs opacity-90">{row.department}</p>
                    )}
                    <p className="mt-2 text-3xl font-extrabold">
                      +{row.totalCount}
                      <span className="text-sm ml-1 font-normal opacity-90">콜</span>
                    </p>
                    {row.conversionRate !== null && (
                      <p className="text-xs mt-1 opacity-90">
                        전환율 {row.conversionRate}%
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 4등 이하 막대 */}
            {rest.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                {rest.map((row) => {
                  const widthPct = (row.totalCount / maxCount) * 100;
                  const isClickable = row.isMe;
                  return (
                    <button
                      key={row.userId}
                      type="button"
                      onClick={() => handleCardClick(row)}
                      disabled={!isClickable}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                        isClickable
                          ? 'bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300 cursor-pointer'
                          : 'bg-white hover:bg-gray-50 cursor-default'
                      )}
                    >
                      <span className="w-8 text-sm text-slate-500 font-medium">
                        {row.rank}위
                      </span>
                      <span className="w-24 sm:w-28 text-sm font-medium truncate">
                        {row.userName}
                        {isClickable && (
                          <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1">
                            나
                          </Badge>
                        )}
                      </span>
                      <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-sm font-semibold">
                        +{row.totalCount}콜
                      </span>
                      {row.conversionRate !== null && (
                        <span className="w-16 text-right text-xs text-muted-foreground hidden sm:inline">
                          {row.conversionRate}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* 본인 상세 모달 */}
      <MyAwardDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        weekKey={weekKey}
        weekLabel={data?.weekLabel ?? '이번 주'}
      />

      {/* 관리자 배분 다이얼로그 */}
      {isAdmin && (
        <AdminAwardDialog
          open={adminDialogOpen}
          onOpenChange={setAdminDialogOpen}
          weekKey={weekKey}
          onSuccess={fetchData}
        />
      )}
    </Card>
  );
}
