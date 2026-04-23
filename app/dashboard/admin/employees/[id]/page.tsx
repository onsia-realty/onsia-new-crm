'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Users,
  Phone,
  PhoneOff,
  Globe,
  Trophy,
  FileText,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { maskPhonePartial, formatPhone } from '@/lib/utils/phone';

interface EmployeeSummary {
  user: {
    id: string;
    username: string;
    name: string;
    email: string | null;
    phone: string;
    role: string;
    department: string | null;
    position: string | null;
    teamId: string | null;
    isActive: boolean;
    joinedAt: string | null;
    lastLoginAt: string | null;
  };
  stats: {
    myCustomers: number;
    todayCallLogs: number;
    todayMissedCalls: number;
    publicClaimsAllTime: number;
  };
  recentCalls: Array<{
    id: string;
    createdAt: string;
    content: string;
    customer: { id: string; name: string | null; phone: string } | null;
  }>;
  recentCustomers: Array<{
    id: string;
    name: string | null;
    phone: string;
    createdAt: string;
    assignedAt: string | null;
    assignedSite: string | null;
    isPublic: boolean;
  }>;
  recentReports: Array<{
    id: string;
    date: string;
    clockIn: string | null;
    clockOut: string | null;
    customersCreated: number;
    allocationsReceived: number;
    callLogsCreated: number;
    missedCallsCount: number;
    memosCreated: number;
    contractsCount: number;
    subscriptionsCount: number;
    note: string | null;
  }>;
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [data, setData] = useState<EmployeeSummary | null>(null);
  const [myRank, setMyRank] = useState<{ rank: number; totalScore: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const canView = session?.user?.role && ['ADMIN', 'CEO', 'HEAD', 'TEAM_LEADER'].includes(session.user.role);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, leaderboardRes] = await Promise.all([
        fetch(`/api/admin/employees/${id}/summary`),
        fetch(`/api/leaderboard?period=week`),
      ]);
      const summaryJson = await summaryRes.json();
      if (!summaryRes.ok || !summaryJson.success) {
        throw new Error(summaryJson.error || '직원 정보 조회 실패');
      }
      setData(summaryJson.data);

      const lbJson = await leaderboardRes.json();
      if (lbJson.success && Array.isArray(lbJson.data?.rankings)) {
        const match = lbJson.data.rankings.find((r: { userId: string; rank: number; totalScore: number }) => r.userId === id);
        if (match) setMyRank({ rank: match.rank, totalScore: match.totalScore });
      }
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '조회 실패',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (!canView) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [status, session, canView, router, fetchData]);

  if (status === 'loading' || !canView) {
    return <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>;
  }

  if (loading && !data) {
    return <div className="p-6 text-sm text-muted-foreground">직원 정보 로딩 중...</div>;
  }

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">데이터를 불러올 수 없습니다.</div>;
  }

  const { user, stats, recentCalls, recentCustomers, recentReports } = data;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            뒤로
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold">{user.name}</h1>
              <Badge variant="outline">{user.role}</Badge>
              {!user.isActive && <Badge variant="destructive">비활성</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {user.department || '부서 미지정'}
              {user.position ? ` · ${user.position}` : ''}
              {' · '}
              {user.username}
              {' · '}
              {formatPhone(user.phone)}
            </p>
          </div>
        </div>
        <Link href={`/dashboard/customers?userId=${user.id}&viewAll=true`}>
          <Button>
            <Users className="h-4 w-4 mr-1" />
            담당 고객 전체 보기
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>

      {/* 핵심 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">담당 고객</p>
                <p className="text-2xl font-bold">{stats.myCustomers.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">오늘 통화</p>
                <p className="text-2xl font-bold">{stats.todayCallLogs.toLocaleString()}</p>
              </div>
              <Phone className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">오늘 부재</p>
                <p className="text-2xl font-bold">{stats.todayMissedCalls.toLocaleString()}</p>
              </div>
              <PhoneOff className="w-8 h-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">공개DB 클레임 (누적)</p>
                <p className="text-2xl font-bold">{stats.publicClaimsAllTime.toLocaleString()}</p>
              </div>
              <Globe className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-700">이번 주 순위</p>
                <p className="text-2xl font-bold text-amber-900">
                  {myRank ? `${myRank.rank}위` : '-'}
                </p>
                {myRank && (
                  <p className="text-xs text-amber-700">{myRank.totalScore.toLocaleString()}점</p>
                )}
              </div>
              <Trophy className="w-8 h-8 text-amber-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2단 레이아웃: 최근 통화 + 최근 고객 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 최근 통화 기록 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" />
              최근 통화 기록 (10건)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">통화 기록이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {recentCalls.map((log) => (
                  <li key={log.id} className="border rounded-md p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <Link
                        href={log.customer ? `/dashboard/customers/${log.customer.id}` : '#'}
                        className="font-medium hover:underline"
                      >
                        {log.customer?.name || '(이름없음)'} ·{' '}
                        <span className="text-muted-foreground text-xs">
                          {log.customer ? maskPhonePartial(log.customer.phone) : ''}
                        </span>
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 mt-1 line-clamp-2">{log.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 최근 담당 고객 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              최근 담당 고객 (10명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">담당 고객이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {recentCustomers.map((c) => (
                  <li key={c.id} className="border rounded-md p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/dashboard/customers/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.name || '(이름없음)'} ·{' '}
                        <span className="text-muted-foreground text-xs">{maskPhonePartial(c.phone)}</span>
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.assignedAt || c.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                      {c.assignedSite && <span>{c.assignedSite}</span>}
                      {c.isPublic && <Badge variant="outline" className="text-[10px] h-4">공개DB</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 업무보고 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            최근 업무보고 (최신 5건)
          </CardTitle>
          <CardDescription>
            자동 집계된 일일 업무 통계입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">업무보고 내역이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>날짜</TableHead>
                    <TableHead className="text-right">등록</TableHead>
                    <TableHead className="text-right">배분</TableHead>
                    <TableHead className="text-right">통화</TableHead>
                    <TableHead className="text-right">부재</TableHead>
                    <TableHead className="text-right">메모</TableHead>
                    <TableHead className="text-right">계약</TableHead>
                    <TableHead className="text-right">청약</TableHead>
                    <TableHead>특이사항</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentReports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {new Date(r.date).toLocaleDateString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-right">{r.customersCreated}</TableCell>
                      <TableCell className="text-right">{r.allocationsReceived}</TableCell>
                      <TableCell className="text-right">{r.callLogsCreated}</TableCell>
                      <TableCell className="text-right">{r.missedCallsCount}</TableCell>
                      <TableCell className="text-right">{r.memosCreated}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {r.contractsCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-blue-600">
                        {r.subscriptionsCount}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {r.note || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
