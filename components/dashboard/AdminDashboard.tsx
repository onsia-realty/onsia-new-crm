'use client';

import { useEffect, useState } from 'react';
import { Session } from 'next-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  LogOut,
  Settings,
  UserPlus,
  ShieldCheck,
  Phone,
  Calendar,
  FileText,
  AlertCircle,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { ReclaimCustomersDialog } from '@/components/admin/ReclaimCustomersDialog';

interface AdminDashboardProps {
  session: Session;
}

interface AdminStats {
  today: {
    newCustomers: number;
    callLogs: number;
    visits: number;
    contracts: number;
  };
  monthly: {
    newCustomers: number;
    callLogs: number;
    visits: number;
    contracts: number;
  };
  totalCustomers: number;
  unassignedCustomers: number;
  alerts: {
    pendingUsersCount: number;
    uncheckedVisitsCount: number;
  };
  pendingUsers: Array<{
    id: string;
    name: string;
    username: string;
    phone: string;
    joinedAt: string;
  }>;
  todaySchedules: Array<{
    id: string;
    visitDate: string;
    status: string;
    memo: string | null;
    customer: {
      id: string;
      name: string | null;
      phone: string;
      assignedSite: string | null;
    };
    user: {
      id: string;
      name: string;
      department: string | null;
    };
  }>;
  employeeStats: Array<{
    id: string;
    name: string;
    department: string;
    customerCount: number;
  }>;
  weekly: {
    schedules: number;
  };
  thisWeekSchedulesList: Array<{
    id: string;
    visitDate: string;
    status: string;
    memo: string | null;
    customer: {
      id: string;
      name: string | null;
      phone: string;
      assignedSite: string | null;
    };
    user: {
      id: string;
      name: string;
      department: string | null;
    };
  }>;
  monthlySubscriptions: number;
  monthlyContractsClosed: number;
}

export default function AdminDashboard({ session }: AdminDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/statistics/admin');
      const result = await response.json();

      if (result.success) {
        setStats(result.data);
      } else {
        toast({
          title: '통계 조회 실패',
          description: result.error || '통계를 불러올 수 없습니다.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching admin statistics:', error);
      const errorMessage = error instanceof Error ? error.message : '서버와의 통신 중 오류가 발생했습니다.';
      toast({
        title: '통계 조회 오류',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // 5분마다 자동 갱신
    const interval = setInterval(fetchStats, 300000);
    return () => clearInterval(interval);
  }, [toast]);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/auth/signin');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">예정</span>;
      case 'CHECKED':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">완료</span>;
      case 'CANCELLED':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">취소</span>;
      case 'NO_SHOW':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">부재</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">통계를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">온시아 CRM</h1>
            <p className="text-sm text-gray-600">환영합니다, {session.user?.name}님 (관리자)</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            로그아웃
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* 승인 대기 알림 */}
        {stats && stats.alerts.pendingUsersCount > 0 && (
          <div className="mb-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
                <p className="text-yellow-800">
                  <strong>{stats.alerts.pendingUsersCount}명</strong>의 직원이 승인 대기 중입니다.
                </p>
              </div>
              <Link href="/admin/users">
                <Button size="sm" variant="outline" className="border-yellow-600 text-yellow-700 hover:bg-yellow-100">
                  지금 승인하기
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* 일정 현황 카드 (2x2 그리드) - 모바일에서만 표시 */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 mb-6 md:hidden">
            <Link href="/dashboard/schedules">
              <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="text-sm text-gray-500 mb-1">오늘 방문 일정</div>
                <div className="text-2xl font-bold text-blue-600">{stats.today.visits}건</div>
              </div>
            </Link>
            <Link href="/dashboard/schedules">
              <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="text-sm text-gray-500 mb-1">이번 주 일정</div>
                <div className="text-2xl font-bold text-purple-600">{stats.weekly?.schedules || 0}건</div>
              </div>
            </Link>
            <Link href="/dashboard/contracts">
              <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="text-sm text-gray-500 mb-1">이번 달 청약</div>
                <div className="text-2xl font-bold text-green-600">{stats.monthlySubscriptions || 0}건</div>
              </div>
            </Link>
            <Link href="/dashboard/contracts">
              <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="text-sm text-gray-500 mb-1">이번 달 계약</div>
                <div className="text-2xl font-bold text-red-600">{stats.monthlyContractsClosed || 0}건</div>
              </div>
            </Link>
          </div>
        )}

        {/* 금일 방문 일정 - 카드 형태로 상단에 표시 */}
        {stats && stats.todaySchedules.length > 0 && (
          <Card className="mb-6 shadow-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardHeader className="bg-blue-100/50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Clock className="h-5 w-5 text-blue-600" />
                  금일 방문 일정
                  <span className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
                    {stats.todaySchedules.length}건
                  </span>
                </CardTitle>
                <Link href="/dashboard/schedules">
                  <Button size="sm" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-100">
                    전체 보기 →
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {stats.todaySchedules.slice(0, 10).map((schedule) => (
                  <div
                    key={schedule.id}
                    className="p-3 bg-white rounded-lg hover:shadow-md transition-shadow border border-blue-100"
                  >
                    {/* 모바일: 세로 배치, PC: 가로 배치 */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      {/* 왼쪽 정보 영역 */}
                      <div className="flex flex-col md:flex-row md:items-center gap-2">
                        {/* 시간 */}
                        <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                          {new Date(schedule.visitDate).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>

                        {/* 직원명 */}
                        <span className="text-sm font-medium text-gray-900">
                          {schedule.user.name}
                        </span>

                        {/* 화살표 (모바일 숨김) */}
                        <span className="text-sm text-gray-400 hidden md:inline">→</span>

                        {/* 고객명 */}
                        <Link
                          href={`/dashboard/customers/${schedule.customer.id}`}
                          className="text-sm font-medium text-blue-700 hover:underline"
                        >
                          {schedule.customer.name || '미등록'}
                        </Link>

                        {/* 현장명 */}
                        {schedule.customer.assignedSite && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded w-fit">
                            {schedule.customer.assignedSite}
                          </span>
                        )}
                      </div>

                      {/* 상태 배지 */}
                      <div className="flex items-center gap-2 w-fit">
                        {getStatusBadge(schedule.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 이번 주 일정 목록 (오늘부터 일요일까지) */}
        {stats && stats.thisWeekSchedulesList && stats.thisWeekSchedulesList.length > 0 && (
          <div className="bg-white border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">이번 주 일정</h3>
              <Link href="/dashboard/schedules" className="text-sm text-blue-600 hover:underline">
                전체 보기 →
              </Link>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {stats.thisWeekSchedulesList.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-20">
                      {new Date(schedule.visitDate).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        weekday: 'short'
                      })}
                    </span>
                    <span className="text-gray-700">{schedule.user.name}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-900">{schedule.customer.name || '미등록'}</span>
                  </div>
                  {getStatusBadge(schedule.status)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 핵심 지표 카드 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* 신규 DB */}
            <Link href="/dashboard/customers">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">신규 DB</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-3">
                    <div>
                      <div className="text-2xl font-bold">{stats.today.newCustomers}</div>
                      <p className="text-xs text-gray-500">오늘</p>
                    </div>
                    <div className="text-gray-300">|</div>
                    <div>
                      <div className="text-xl font-semibold text-gray-700">{stats.totalCustomers}</div>
                      <p className="text-xs text-gray-500">전체 DB</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    이번달: {stats.monthly.newCustomers}건
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* 통화 건수 */}
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">통화 건수</CardTitle>
                <Phone className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.today.callLogs}</div>
                <p className="text-xs text-muted-foreground">
                  오늘 / 이번달: {stats.monthly.callLogs}건
                </p>
              </CardContent>
            </Card>

            {/* 방문 건수 */}
            <Link href="/dashboard/schedules">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">방문 건수</CardTitle>
                  <Calendar className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.today.visits}</div>
                  <p className="text-xs text-muted-foreground">
                    오늘 / 이번달: {stats.monthly.visits}건
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* 계약 건수 */}
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">계약 건수</CardTitle>
                <FileText className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.today.contracts}</div>
                <p className="text-xs text-muted-foreground">
                  오늘 / 이번달: {stats.monthly.contracts}건
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 고객 배분된 직원 리스트 */}
        {stats && (stats.employeeStats.length > 0 || stats.unassignedCustomers > 0) && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>고객 배분 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* 관리자 DB (미배분 고객) - 항상 표시 */}
                <button
                  onClick={() => router.push('/dashboard/customers?unassigned=true')}
                  className="border-2 border-orange-300 bg-orange-50 rounded-lg p-4 hover:bg-orange-100 cursor-pointer transition-all hover:shadow-md text-left"
                >
                  <div className="font-semibold text-gray-900">관리자 DB</div>
                  <div className="text-xs text-orange-600 mb-2">미배분</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.unassignedCustomers ?? 0}
                  </div>
                  <div className="text-xs text-gray-600">고객</div>
                </button>

                {/* 직원별 배분 현황 */}
                {stats.employeeStats.map((emp) => (
                  <div
                    key={emp.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-all hover:shadow-md"
                  >
                    <button
                      onClick={() => router.push(`/dashboard/customers?userId=${emp.id}`)}
                      className="w-full text-left mb-3"
                    >
                      <div className="font-semibold text-gray-900">{emp.name}</div>
                      <div className="text-xs text-gray-500 mb-2">{emp.department || '부서 미지정'}</div>
                      <div className="text-2xl font-bold text-blue-600">{emp.customerCount}</div>
                      <div className="text-xs text-gray-600">고객</div>
                    </button>
                    <ReclaimCustomersDialog
                      userId={emp.id}
                      userName={emp.name}
                      customerCount={emp.customerCount}
                      onSuccess={() => fetchStats()}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 관리자 메뉴 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">관리자 메뉴</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/users">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
                <CardContent className="p-6">
                  {stats && stats.alerts.pendingUsersCount > 0 && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                      {stats.alerts.pendingUsersCount}
                    </div>
                  )}
                  <Users className="h-8 w-8 text-blue-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">사용자 관리</h3>
                  <p className="text-sm text-gray-600">직원 계정 및 권한 관리</p>
                </CardContent>
              </Card>
            </Link>

            {/* 광고콜 배분 - 모바일/PC 모두 표시 */}
            <Link href="/dashboard/ad-calls/distribute">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <Phone className="h-8 w-8 text-orange-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">광고콜 배분</h3>
                  <p className="text-sm text-gray-600">광고콜을 직원에게 배분</p>
                </CardContent>
              </Card>
            </Link>

            {/* 고객 배분 - PC에서만 표시 (모바일 숨김) */}
            <Link href="/admin/allocation" className="hidden md:block">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <UserPlus className="h-8 w-8 text-green-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">고객 배분</h3>
                  <p className="text-sm text-gray-600">고객을 직원에게 배분</p>
                </CardContent>
              </Card>
            </Link>

            {/* 권한 설정 - PC에서만 표시 (모바일 숨김) */}
            <Link href="/admin/settings" className="hidden md:block">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <ShieldCheck className="h-8 w-8 text-purple-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">권한 설정</h3>
                  <p className="text-sm text-gray-600">시스템 권한 관리</p>
                </CardContent>
              </Card>
            </Link>

            {/* 시스템 설정 - PC에서만 표시 (모바일 숨김) */}
            <Link href="/admin/settings" className="hidden md:block">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <Settings className="h-8 w-8 text-gray-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">시스템 설정</h3>
                  <p className="text-sm text-gray-600">전체 시스템 설정</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
