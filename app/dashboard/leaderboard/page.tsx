'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Trophy, RefreshCw, Medal, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Period = 'today' | 'week' | 'month';

interface RankRow {
  rank: number;
  userId: string;
  userName: string;
  team: string | null;
  department: string | null;
  callCount: number;
  absenceCallCount: number;
  publicClaimCount: number;
  newCustomerCount: number;
  contractCount: number;
  totalScore: number;
}

interface LeaderboardData {
  period: Period;
  rangeFrom: string;
  rangeTo: string;
  weights: {
    call: number;
    absence: number;
    publicClaim: number;
    newCustomer: number;
    contract: number;
  };
  rankings: RankRow[];
  myRank: RankRow | null;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: '오늘',
  week: '이번 주',
  month: '이번 달',
};

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?period=${period}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || '리더보드 조회 실패');
      }
      setData(json.data);
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '리더보드 조회 실패',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [period, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const myUserId = session?.user?.id;
  const top3 = data?.rankings.slice(0, 3) ?? [];
  const { myRank, rangeFrom, rangeTo } = data ?? { myRank: null, rangeFrom: '', rangeTo: '' };

  const rangeLabel =
    rangeFrom && rangeTo
      ? `${new Date(rangeFrom).toLocaleDateString('ko-KR')} ~ ${new Date(
          new Date(rangeTo).getTime() - 1
        ).toLocaleDateString('ko-KR')}`
      : '';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-7 w-7 text-yellow-500" />
          <h1 className="text-2xl md:text-3xl font-bold">경쟁 리더보드</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            {(['today', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 text-sm transition-colors',
                  period === p
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white hover:bg-gray-50'
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* 기간 정보 */}
      {rangeLabel && (
        <p className="text-xs text-muted-foreground">
          집계 기간: <span className="font-medium">{rangeLabel}</span>
        </p>
      )}

      {/* 내 순위 카드 (EMPLOYEE) */}
      {myRank && (
        <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-xs text-amber-700">내 순위</p>
                <p className="text-2xl font-bold text-amber-900">
                  {myRank.rank}위 / {data?.rankings.length}명 중
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-amber-700">내 종합 점수</p>
              <p className="text-2xl font-bold text-amber-900">{myRank.totalScore.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TOP 3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {top3.map((row, i) => {
            const medals = ['🥇', '🥈', '🥉'];
            const borderClr = ['border-yellow-300', 'border-gray-300', 'border-orange-300'];
            const bgClr = ['bg-yellow-50', 'bg-gray-50', 'bg-orange-50'];
            return (
              <Card key={row.userId} className={cn(borderClr[i], bgClr[i], 'border-2')}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="text-3xl">{medals[i]}</div>
                    <Badge variant="outline" className="text-xs">
                      {row.rank}위
                    </Badge>
                  </div>
                  <p className="mt-2 text-lg font-bold">{row.userName}</p>
                  {(row.team || row.department) && (
                    <p className="text-xs text-muted-foreground">
                      {[row.team, row.department].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="mt-2 text-3xl font-bold text-primary">
                    {row.totalScore.toLocaleString()}
                    <span className="text-sm ml-1 font-normal text-muted-foreground">점</span>
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-gray-700">
                    <div>통화 {row.callCount}</div>
                    <div>부재 {row.absenceCallCount}</div>
                    <div>클레임 {row.publicClaimCount}</div>
                    <div>신규 {row.newCustomerCount}</div>
                    <div className="col-span-2">계약 {row.contractCount}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 전체 순위 표 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">전체 순위</CardTitle>
          <CardDescription>
            종합 점수 = 통화×{data?.weights.call ?? 1} + 공개DB 클레임×{data?.weights.publicClaim ?? 5}
            <span className="block text-xs text-muted-foreground mt-1">
              ※ 부재·신규·계약은 참고용으로 표시되며 점수에는 포함되지 않습니다.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <p className="text-sm text-muted-foreground py-6 text-center">로딩 중...</p>
          ) : !data?.rankings.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">집계 대상 직원이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-center">순위</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead className="hidden md:table-cell">소속</TableHead>
                    <TableHead className="text-right">통화</TableHead>
                    <TableHead className="text-right">부재</TableHead>
                    <TableHead className="text-right">공개DB</TableHead>
                    <TableHead className="text-right">신규</TableHead>
                    <TableHead className="text-right">계약</TableHead>
                    <TableHead className="text-right font-bold">종합</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rankings.map((row) => {
                    const isMe = row.userId === myUserId;
                    return (
                      <TableRow
                        key={row.userId}
                        className={cn(isMe && 'bg-yellow-50 hover:bg-yellow-100')}
                      >
                        <TableCell className="text-center font-medium">
                          {row.rank <= 3 ? (
                            <Medal
                              className={cn(
                                'h-5 w-5 inline',
                                row.rank === 1 && 'text-yellow-500',
                                row.rank === 2 && 'text-gray-400',
                                row.rank === 3 && 'text-orange-500'
                              )}
                            />
                          ) : (
                            row.rank
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.userName}
                          {isMe && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              나
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {[row.team, row.department].filter(Boolean).join(' · ') || '-'}
                        </TableCell>
                        <TableCell className="text-right">{row.callCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.absenceCallCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.publicClaimCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.newCustomerCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.contractCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold">
                          {row.totalScore.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
