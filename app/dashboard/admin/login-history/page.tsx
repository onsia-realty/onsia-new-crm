'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { KeyRound, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LoginLog {
  id: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  changes: { username?: string; reason?: string } | null;
  createdAt: string;
  user: { name: string; username: string; role: string } | null;
}

interface UserSummary {
  id: string;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
}

const DAY_OPTIONS = [
  { value: 7, label: '7일' },
  { value: 30, label: '30일' },
  { value: 90, label: '90일' },
];

const REASON_LABEL: Record<string, string> = {
  NO_USER: '없는 아이디',
  NOT_APPROVED: '미승인 계정',
  INACTIVE: '비활성 계정',
  WRONG_PASSWORD: '비밀번호 불일치',
};

// KST 기준 일시 표기
function formatKst(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 마지막 활동으로부터 경과 일수
function daysSince(value: string | null): number | null {
  if (!value) return null;
  return Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000));
}

// User-Agent를 "Windows Chrome" 수준으로 간략 파싱
function parseUserAgent(ua: string | null): string {
  if (!ua || ua === 'unknown') return '-';
  let os = '기타';
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = '기타';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung';
  else if (/KAKAOTALK/i.test(ua)) browser = '카카오톡';
  else if (/Whale/i.test(ua)) browser = 'Whale';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  return `${os} ${browser}`;
}

export default function LoginHistoryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();

  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState<string>('all');
  const [days, setDays] = useState<number>(30);
  const [onlyFailed, setOnlyFailed] = useState(false);

  const canView = session?.user?.role === 'ADMIN' || session?.user?.role === 'CEO';

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('days', String(days));
      params.set('limit', '100');
      if (userId !== 'all') params.set('userId', userId);
      if (onlyFailed) params.set('onlyFailed', 'true');

      const res = await fetch(`/api/admin/login-history?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '로그인 기록 조회 실패');

      setLogs(json.data.logs ?? []);
      setUsers(json.data.users ?? []);
      setTotal(json.data.total ?? 0);
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '로그인 기록 조회 실패',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [days, userId, onlyFailed, toast]);

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
    loadHistory();
  }, [status, session, canView, router, loadHistory]);

  if (status === 'loading' || !canView) {
    return <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <KeyRound className="h-7 w-7" /> 로그인 기록
        </h1>
        <Button variant="outline" size="sm" onClick={loadHistory} disabled={loading}>
          새로고침
        </Button>
      </div>

      {/* 1. 직원별 요약 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> 직원별 접속 현황
          </CardTitle>
          <CardDescription>
            세션이 JWT 방식이라 재로그인 전까지 &lsquo;마지막 로그인&rsquo;은 갱신되지 않습니다.
            실제 사용 여부는 &lsquo;마지막 활동&rsquo;으로 판단하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {loading ? '로딩 중...' : '직원이 없습니다.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>마지막 로그인</TableHead>
                    <TableHead>마지막 활동</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const idle = daysSince(u.lastActivityAt);
                    const stale = idle === null || idle > 7;
                    return (
                      <TableRow key={u.id} className={stale ? 'bg-gray-50' : undefined}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{u.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {u.role}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{u.username}</p>
                        </TableCell>
                        <TableCell className="text-sm">{formatKst(u.lastLoginAt)}</TableCell>
                        <TableCell className={`text-sm ${stale ? 'text-muted-foreground' : ''}`}>
                          {formatKst(u.lastActivityAt)}
                          {idle !== null && idle > 7 && (
                            <span className="ml-2 text-xs text-amber-600">{idle}일 전</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!u.isActive ? (
                            <Badge variant="destructive" className="text-xs">
                              비활성
                            </Badge>
                          ) : stale ? (
                            <Badge variant="secondary" className="text-xs">
                              장기 미접속
                            </Badge>
                          ) : (
                            <Badge className="text-xs">활성</Badge>
                          )}
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

      {/* 2. 로그인 기록 타임라인 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">로그인 기록</CardTitle>
          <CardDescription>총 {total.toLocaleString()}건 (최근 {days}일)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 필터 */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm bg-white"
            >
              <option value="all">전체 직원</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.username})
                </option>
              ))}
            </select>

            <div className="flex gap-1">
              {DAY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                    days === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setOnlyFailed((v) => !v)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                onlyFailed
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white hover:bg-gray-50'
              }`}
            >
              실패만 보기
            </button>
          </div>

          {loading && logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">로딩 중...</p>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center space-y-1">
              <p className="text-sm text-muted-foreground">아직 기록이 없습니다.</p>
              <p className="text-xs text-muted-foreground">
                로그인 기록은 이 기능이 도입된 시점부터 쌓입니다. 이전 로그인은 기록이 남아있지 않습니다.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>일시 (KST)</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>결과</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>접속기기</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const failed = log.action === 'LOGIN_FAILED';
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatKst(log.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.user?.name ?? log.changes?.username ?? '알 수 없음'}
                          {log.user?.username && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({log.user.username})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {failed ? (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="destructive" className="text-xs">
                                실패
                              </Badge>
                              {log.changes?.reason && (
                                <span className="text-xs text-muted-foreground">
                                  {REASON_LABEL[log.changes.reason] ?? log.changes.reason}
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge className="text-xs">성공</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.ipAddress && log.ipAddress !== 'unknown' ? log.ipAddress : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {parseUserAgent(log.userAgent)}
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
