'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Phone,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

interface UserStat {
  user: {
    id: string;
    name: string;
    username: string;
    department: string | null;
    position: string | null;
    role: string;
  };
  report: {
    id: string;
    clockIn: string | null;
    clockOut: string | null;
    contractsCount: number;
    subscriptionsCount: number;
    note: string | null;
  } | null;
  stats: {
    customersCreated: number;
    callLogsCreated: number;
    memosCreated: number;
  };
  visits: Array<{
    id: string;
    visitDate: string;
    status: string;
    customer: { name: string | null; phone: string };
  }>;
  hasReport: boolean;
  hasClockedIn: boolean;
  hasClockedOut: boolean;
}

interface AdminReportData {
  date: string;
  summary: {
    totalUsers: number;
    reportedUsers: number;
    clockedInUsers: number;
    clockedOutUsers: number;
    totalCustomers: number;
    totalCallLogs: number;
    totalContracts: number;
    totalSubscriptions: number;
    totalVisits: number;
  };
  userStats: UserStat[];
}

export default function AdminReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AdminReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    fetchReports();
  }, [session, status, router, selectedDate]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await fetch(`/api/daily-reports/admin?date=${dateStr}`);

      if (res.ok) {
        const result = await res.json();

        // 특정 사용자 제외 (김수경, 관리자, 대표이사, 연대겸)
        const excludedNames = ['김수경', '관리자', '대표이사', '연대겸'];
        const filteredUserStats = result.userStats.filter((stat: UserStat) =>
          !excludedNames.includes(stat.userName)
        );

        setData({
          ...result,
          userStats: filteredUserStats
        });
      } else if (res.status === 403) {
        toast.error('권한이 없습니다.');
        router.push('/dashboard');
      } else {
        toast.error('데이터를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('업무보고 조회 오류:', error);
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const handleToday = () => setSelectedDate(new Date());

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">업무보고 현황</h1>
          <p className="text-muted-foreground">
            전체 직원의 업무보고를 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday}>
            오늘
          </Button>
          <Input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="w-40"
          />
          <Button variant="outline" size="icon" onClick={handleNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={fetchReports}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 날짜 표시 */}
      <div className="text-center py-2 bg-gray-50 rounded-lg">
        <p className="text-lg font-semibold">
          {format(selectedDate, 'yyyy년 M월 d일 EEEE', { locale: ko })}
        </p>
      </div>

      {/* 요약 카드 */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">전체 직원</span>
              </div>
              <p className="text-xl font-bold">{data.summary.totalUsers}명</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">출근</span>
              </div>
              <p className="text-xl font-bold">{data.summary.clockedInUsers}명</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-muted-foreground">고객 등록</span>
              </div>
              <p className="text-xl font-bold">{data.summary.totalCustomers}건</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="h-4 w-4 text-indigo-600" />
                <span className="text-xs text-muted-foreground">통화/메모</span>
              </div>
              <p className="text-xl font-bold">{data.summary.totalCallLogs}건</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-amber-600" />
                <span className="text-xs text-muted-foreground">계약</span>
              </div>
              <p className="text-xl font-bold">{data.summary.totalContracts}건</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-teal-600" />
                <span className="text-xs text-muted-foreground">방문 일정</span>
              </div>
              <p className="text-xl font-bold">{data.summary.totalVisits}건</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 직원별 상세 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>직원별 업무보고</CardTitle>
          <CardDescription>
            각 직원의 출퇴근 및 업무 현황을 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>직원</TableHead>
                  <TableHead className="text-center">출근</TableHead>
                  <TableHead className="text-center">퇴근</TableHead>
                  <TableHead className="text-center">고객 등록</TableHead>
                  <TableHead className="text-center">통화/메모</TableHead>
                  <TableHead className="text-center">방문 일정</TableHead>
                  <TableHead className="text-center">계약</TableHead>
                  <TableHead className="text-center">청약</TableHead>
                  <TableHead>비고</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.userStats.map((stat) => (
                  <TableRow key={stat.user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{stat.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {stat.user.department} {stat.user.position}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {stat.report?.clockIn ? (
                        <div>
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            {format(new Date(stat.report.clockIn), 'HH:mm')}
                          </Badge>
                        </div>
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {stat.report?.clockOut ? (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                          {format(new Date(stat.report.clockOut), 'HH:mm')}
                        </Badge>
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {stat.stats.customersCreated}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {stat.stats.callLogsCreated}
                    </TableCell>
                    <TableCell className="text-center">
                      {stat.visits.length > 0 ? (
                        <div className="space-y-1">
                          {stat.visits.slice(0, 2).map((visit) => (
                            <div key={visit.id} className="text-xs">
                              <span className="font-medium">
                                {format(new Date(visit.visitDate), 'HH:mm')}
                              </span>
                              <span className="text-muted-foreground ml-1">
                                {visit.customer.name || '미지정'}
                              </span>
                            </div>
                          ))}
                          {stat.visits.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{stat.visits.length - 2}건
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {stat.report?.contractsCount || 0}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {stat.report?.subscriptionsCount || 0}
                    </TableCell>
                    <TableCell>
                      {stat.report?.note ? (
                        <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                          {stat.report.note}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.userStats || data.userStats.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
