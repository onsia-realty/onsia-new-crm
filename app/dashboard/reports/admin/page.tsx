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

        console.log('API 응답 데이터:', result);
        console.log('전체 사용자 수:', result.userStats?.length);

        // 표시할 직원들만 필터링 (화이트리스트)
        const allowedNames = ['박찬효', '안소이', '윤상', '임현선', '추재현', '테스트11'];
        const filteredUserStats = result.userStats.filter((stat: UserStat) => {
          return allowedNames.includes(stat.user?.name || '');
        });

        console.log('필터링된 사용자 수:', filteredUserStats.length);

        setData({
          ...result,
          userStats: filteredUserStats,
          summary: {
            ...result.summary,
            totalUsers: filteredUserStats.length,
          }
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
    <div className="space-y-4 md:space-y-6">
      {/* 헤더 - 모바일 최적화 */}
      <div className="space-y-3">
        <h1 className="text-xl md:text-2xl font-bold">업무보고 현황</h1>

        {/* 날짜 네비게이션 - 모바일에서 컴팩트하게 */}
        <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg shadow-sm">
          <Button variant="ghost" size="icon" onClick={handlePrevDay} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 justify-center">
            <button
              onClick={handleToday}
              className="text-sm md:text-base font-semibold text-center hover:text-blue-600 transition-colors"
            >
              {format(selectedDate, 'M/d (EEE)', { locale: ko })}
            </button>
            <Input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="w-8 h-8 p-0 opacity-0 absolute"
              style={{ cursor: 'pointer' }}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextDay} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchReports} className="h-8 w-8">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 요약 카드 - 모바일에서 2x3 그리드, 컴팩트 */}
      {data && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-4">
          <Card className="p-2 md:p-0">
            <CardContent className="p-2 md:pt-4">
              <div className="flex flex-col items-center md:items-start md:flex-row md:gap-2 mb-1">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-[10px] md:text-xs text-muted-foreground">직원</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-center md:text-left">{data.summary.totalUsers}</p>
            </CardContent>
          </Card>

          <Card className="p-2 md:p-0">
            <CardContent className="p-2 md:pt-4">
              <div className="flex flex-col items-center md:items-start md:flex-row md:gap-2 mb-1">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="text-[10px] md:text-xs text-muted-foreground">출근</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-center md:text-left">{data.summary.clockedInUsers}</p>
            </CardContent>
          </Card>

          <Card className="p-2 md:p-0">
            <CardContent className="p-2 md:pt-4">
              <div className="flex flex-col items-center md:items-start md:flex-row md:gap-2 mb-1">
                <Users className="h-4 w-4 text-purple-600" />
                <span className="text-[10px] md:text-xs text-muted-foreground">고객</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-center md:text-left">{data.summary.totalCustomers}</p>
            </CardContent>
          </Card>

          <Card className="p-2 md:p-0">
            <CardContent className="p-2 md:pt-4">
              <div className="flex flex-col items-center md:items-start md:flex-row md:gap-2 mb-1">
                <Phone className="h-4 w-4 text-indigo-600" />
                <span className="text-[10px] md:text-xs text-muted-foreground">통화</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-center md:text-left">{data.summary.totalCallLogs}</p>
            </CardContent>
          </Card>

          <Card className="p-2 md:p-0">
            <CardContent className="p-2 md:pt-4">
              <div className="flex flex-col items-center md:items-start md:flex-row md:gap-2 mb-1">
                <FileText className="h-4 w-4 text-amber-600" />
                <span className="text-[10px] md:text-xs text-muted-foreground">계약</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-center md:text-left">{data.summary.totalContracts}</p>
            </CardContent>
          </Card>

          <Card className="p-2 md:p-0">
            <CardContent className="p-2 md:pt-4">
              <div className="flex flex-col items-center md:items-start md:flex-row md:gap-2 mb-1">
                <Calendar className="h-4 w-4 text-teal-600" />
                <span className="text-[10px] md:text-xs text-muted-foreground">방문</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-center md:text-left">{data.summary.totalVisits}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 직원별 상세 - 모바일: 카드 리스트, PC: 테이블 */}
      {/* 모바일 카드 뷰 */}
      <div className="md:hidden space-y-3">
        {data?.userStats.map((stat) => (
          <Card key={stat.user.id} className="overflow-hidden">
            <CardContent className="p-3">
              {/* 직원 정보 + 출퇴근 */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b">
                <div>
                  <p className="font-semibold text-sm">{stat.user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {stat.user.department} {stat.user.position}
                  </p>
                </div>
                <div className="flex gap-1">
                  {stat.report?.clockIn ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs px-2 py-0.5">
                      {format(new Date(stat.report.clockIn), 'HH:mm')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-400 text-xs px-2 py-0.5">
                      미출근
                    </Badge>
                  )}
                  {stat.report?.clockOut && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5">
                      {format(new Date(stat.report.clockOut), 'HH:mm')}
                    </Badge>
                  )}
                </div>
              </div>

              {/* 실적 그리드 */}
              <div className="grid grid-cols-5 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground">고객</p>
                  <p className="font-semibold text-sm">{stat.stats.customersCreated}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">통화</p>
                  <p className="font-semibold text-sm">{stat.stats.callLogsCreated}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">방문</p>
                  <p className="font-semibold text-sm">{stat.visits.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">계약</p>
                  <p className="font-semibold text-sm">{stat.report?.contractsCount || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">청약</p>
                  <p className="font-semibold text-sm">{stat.report?.subscriptionsCount || 0}</p>
                </div>
              </div>

              {/* 방문 일정 상세 (있을 경우) */}
              {stat.visits.length > 0 && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-[10px] text-muted-foreground mb-1">방문 일정</p>
                  <div className="flex flex-wrap gap-1">
                    {stat.visits.slice(0, 3).map((visit) => (
                      <span key={visit.id} className="text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">
                        {format(new Date(visit.visitDate), 'HH:mm')} {visit.customer.name || '미지정'}
                      </span>
                    ))}
                    {stat.visits.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{stat.visits.length - 3}건</span>
                    )}
                  </div>
                </div>
              )}

              {/* 비고 (있을 경우) */}
              {stat.report?.note && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground">{stat.report.note}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {(!data?.userStats || data.userStats.length === 0) && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              데이터가 없습니다.
            </CardContent>
          </Card>
        )}
      </div>

      {/* PC 테이블 뷰 */}
      <Card className="hidden md:block">
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
