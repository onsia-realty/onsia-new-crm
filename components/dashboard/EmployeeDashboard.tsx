'use client';

import { useEffect, useState } from 'react';
import { Session } from 'next-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, Calendar, Trophy, TrendingUp, Phone, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import VisitCalendar from './VisitCalendar';
import WeeklyCalendar from './WeeklyCalendar';

interface EmployeeStatistics {
  myCustomers: number;
  myCallsToday: number;
  myScheduledVisits: number;
  myMonthlyContracts: number;
  myNewCustomersToday: number;
  myInterestCardsToday: number;
  todayVisits: number;
}

interface TopEmployee {
  id: string;
  name: string;
  count: number;
}

interface TeamActivity {
  id: string;
  userName: string;
  action: string;
  timestamp: Date;
  icon: string;
}

interface TeamVisitActivity {
  id: string;
  userName: string;
  customerName: string;
  customerId: string;
  visitDate: Date;
  createdAt: Date;
  assignedUserId: string;
  visitType: string;
}

interface OnlineUser {
  id: string;
  name: string;
  role: string;
  department: string | null;
}

interface EmployeeDashboardProps {
  session: Session;
}

export default function EmployeeDashboard({ session }: EmployeeDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [statistics, setStatistics] = useState<EmployeeStatistics | null>(null);
  const [activities, setActivities] = useState<TeamActivity[]>([]);
  const [teamVisits, setTeamVisits] = useState<TeamVisitActivity[]>([]);
  const [topContracts, setTopContracts] = useState<TopEmployee[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // 각 API를 독립적으로 호출 (하나가 실패해도 다른 것은 계속 실행)
      try {
        const statsResponse = await fetch('/api/statistics/employee');
        const statsResult = await statsResponse.json();
        if (statsResult.success) {
          setStatistics(statsResult.data);
        }
      } catch (error) {
        console.error('Error fetching employee statistics:', error);
      }

      try {
        const activityResponse = await fetch('/api/activities/team');
        const activityResult = await activityResponse.json();
        if (activityResult.success) {
          setActivities(activityResult.data);
        }
      } catch (error) {
        console.error('Error fetching team activities:', error);
      }

      try {
        const teamVisitsResponse = await fetch('/api/activities/team-visits');
        const teamVisitsResult = await teamVisitsResponse.json();
        if (teamVisitsResult.success) {
          setTeamVisits(teamVisitsResult.data);
        }
      } catch (error) {
        console.error('Error fetching team visits:', error);
      }

      try {
        const topContractsResponse = await fetch('/api/statistics/top-contracts');
        const topContractsResult = await topContractsResponse.json();
        if (topContractsResult.success) {
          setTopContracts(topContractsResult.data);
        }
      } catch (error) {
        console.error('Error fetching top contracts:', error);
      }

      try {
        const onlineResponse = await fetch('/api/users/online');
        const onlineResult = await onlineResponse.json();
        if (onlineResult.success) {
          setOnlineUsers(onlineResult.data || []);
        }
      } catch (error) {
        console.error('Error fetching online users:', error);
        setOnlineUsers([]);
      }

      setLoading(false);
    };

    fetchData();

    // 30초마다 활동 피드 및 온라인 사용자 새로고침
    const interval = setInterval(async () => {
      try {
        // 각 API를 독립적으로 호출 (하나가 실패해도 다른 것은 계속 실행)
        fetch('/api/activities/team')
          .then(res => res.json())
          .then(result => {
            if (result.success) {
              setActivities(result.data);
            }
          })
          .catch(err => console.error('Error fetching team activities:', err));

        fetch('/api/activities/team-visits')
          .then(res => res.json())
          .then(result => {
            if (result.success) {
              setTeamVisits(result.data);
            }
          })
          .catch(err => console.error('Error fetching team visits:', err));

        fetch('/api/users/online')
          .then(res => res.json())
          .then(result => {
            if (result.success) {
              setOnlineUsers(result.data || []);
            }
          })
          .catch(err => console.error('Error fetching online users:', err));
      } catch (error) {
        console.error('Error in refresh interval:', error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    toast({
      title: '로그아웃',
      description: '성공적으로 로그아웃되었습니다.',
    });
    router.push('/auth/signin');
  };

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - new Date(timestamp).getTime()) / 1000);

    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
  };

  const handleTeamVisitClick = (customerId: string, assignedUserId: string | null) => {
    // 내 고객인지 확인
    if (assignedUserId === session.user.id) {
      router.push(`/dashboard/customers/${customerId}`);
    } else {
      toast({
        title: '권한 없음',
        description: '다른 직원의 고객입니다. 접근할 수 없습니다.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 - 고정 */}
      <header className="bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-50">
        <div className="px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">온시아 CRM</h1>
            <p className="text-xs text-gray-600">{session.user?.name}님, 오늘도 화이팅! 💪</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => router.push('/dashboard/customers')} variant="outline" size="sm">
              <Users className="mr-1 h-4 w-4" />
              고객 검색
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm">
              <LogOut className="mr-1 h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      {/* 헤더 높이만큼 여백 추가 */}
      <div className="h-16"></div>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* 좌측: 방문 일정 캘린더 (70%) */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* 방문 완료 TOP 5 */}
            <Card className="shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <CardHeader className="border-b bg-purple-100/50 py-3">
                <CardTitle className="flex items-center gap-2 text-purple-800 text-sm">
                  <Trophy className="h-4 w-4" />
                  방문 완료 TOP 5
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {loading ? (
                  <p className="text-center text-gray-500 py-4 text-sm">로딩 중...</p>
                ) : topContracts.length > 0 ? (
                  <div className="space-y-2">
                    {topContracts.slice(0, 5).map((employee, index) => (
                      <div key={employee.id} className="flex items-center gap-2 p-2 bg-white rounded-lg shadow-sm">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                          index === 0 ? 'bg-purple-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-blue-400'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{employee.name}</p>
                          <p className="text-xs text-blue-600 font-bold">방문완료 +{employee.count}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-4 text-sm">아직 데이터가 없습니다</p>
                )}
              </CardContent>
            </Card>

            {/* 오늘의 목표 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-600 font-medium">내 고객</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {loading ? '...' : statistics?.myCustomers || 0}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-green-600 font-medium">오늘 통화</p>
                      <p className="text-2xl font-bold text-green-700">
                        {loading ? '...' : statistics?.myCallsToday || 0}
                      </p>
                    </div>
                    <Phone className="h-8 w-8 text-green-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-yellow-600 font-medium">예정 방문</p>
                      <p className="text-2xl font-bold text-yellow-700">
                        {loading ? '...' : statistics?.myScheduledVisits || 0}
                      </p>
                    </div>
                    <Calendar className="h-8 w-8 text-yellow-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-600 font-medium">이달 계약</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {loading ? '...' : statistics?.myMonthlyContracts || 0}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 방문 일정 캘린더 */}
            <Card className="shadow-lg">
              <CardHeader className="bg-blue-50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    방문 일정 캘린더
                  </CardTitle>
                  <Button onClick={() => router.push('/dashboard/schedules')} size="sm">
                    전체 일정 보기
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-2 md:p-6">
                {/* 모바일 (< 768px): 주간 캘린더 */}
                <div className="block md:hidden">
                  <WeeklyCalendar />
                </div>
                {/* PC/태블릿 (>= 768px): 월간 캘린더 */}
                <div className="hidden md:block">
                  <VisitCalendar />
                </div>
              </CardContent>
            </Card>

            {/* 오늘 해야 할 일 */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50">
                <CardTitle className="text-orange-700">🎯 오늘 해야 할 일</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {/* 1. 신규 고객 등록 50건 */}
                  <div className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-md transition-shadow">
                    <input type="checkbox" className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium">신규 고객 등록 50건</p>
                      <p className="text-sm font-semibold text-blue-600">
                        {loading ? '...' : statistics?.myNewCustomersToday || 0} / 50건 등록 완료
                      </p>
                    </div>
                    <Button onClick={() => router.push('/dashboard/customers/new')} variant="ghost" size="sm">
                      등록
                    </Button>
                  </div>

                  {/* 2. 관심카드 3건 등록 */}
                  <div className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-md transition-shadow">
                    <input type="checkbox" className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium">관심카드 3건 등록</p>
                      <p className="text-sm font-semibold text-green-600">
                        {loading ? '...' : statistics?.myInterestCardsToday || 0} / 3건 등록 완료
                      </p>
                    </div>
                    <Button onClick={() => router.push('/dashboard/cards')} variant="ghost" size="sm">
                      등록
                    </Button>
                  </div>

                  {/* 3. 고객 관리 통화 100건 */}
                  <div className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-md transition-shadow">
                    <input type="checkbox" className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium">고객 관리 통화 100건</p>
                      <p className="text-sm font-semibold text-purple-600">
                        {loading ? '...' : statistics?.myCallsToday || 0} / 100건 통화 완료
                      </p>
                    </div>
                    <Button onClick={() => router.push('/dashboard/customers')} variant="ghost" size="sm">
                      기록
                    </Button>
                  </div>

                  {/* 4. 방문 고객 체크하기 */}
                  <div className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-md transition-shadow">
                    <input type="checkbox" className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium">방문 고객 체크하기</p>
                      <p className="text-sm font-semibold text-orange-600">
                        금일 방문 {loading ? '...' : statistics?.todayVisits || 0}건 → 스케줄 확인
                      </p>
                    </div>
                    <Button onClick={() => router.push('/dashboard/schedules')} variant="ghost" size="sm">
                      확인
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 우측: 실시간 활동 피드 (30%) */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* 개인 방문 일정 */}
            <Card className="shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <CardHeader className="border-b bg-blue-100/50 py-3">
                <CardTitle className="flex items-center gap-2 text-blue-800 text-sm">
                  <Calendar className="h-4 w-4" />
                  개인 방문 일정
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 max-h-[400px] overflow-y-auto">
                {loading ? (
                  <p className="text-center text-gray-500 py-4 text-sm">로딩 중...</p>
                ) : teamVisits.length > 0 ? (
                  <div className="space-y-2">
                    {teamVisits.map((visit) => (
                      <div
                        key={visit.id}
                        onClick={() => handleTeamVisitClick(visit.customerId, visit.assignedUserId)}
                        className="p-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-blue-100"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-semibold text-sm text-blue-900">
                            {visit.userName} - {visit.customerName}
                          </p>
                          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                            {getTimeAgo(visit.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          방문일: {new Date(visit.visitDate).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            weekday: 'short'
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-4 text-sm">최근 7일 내 방문 일정이 없습니다</p>
                )}
              </CardContent>
            </Card>

            {/* 실시간 전체 활동 피드 */}
            <Card className="shadow-lg sticky top-24">
              <CardHeader className="bg-blue-50 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-blue-700">🔥 전체 활동 피드 (실시간)</CardTitle>
                    <p className="text-xs text-gray-600 mt-1">다른 직원들이 뭐하고 있을까요?</p>
                  </div>
                  <div className="flex items-center gap-1 bg-green-100 px-2 py-1 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-green-700">{onlineUsers.length}명 접속중</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 max-h-[600px] overflow-y-auto">
                {/* 온라인 사용자 목록 */}
                {onlineUsers.length > 0 && (
                  <div className="mb-4 pb-4 border-b">
                    <p className="text-xs font-semibold text-gray-600 mb-2">현재 접속 중</p>
                    <div className="flex flex-wrap gap-2">
                      {onlineUsers.map((user) => (
                        <div key={user.id} className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs font-medium text-green-800">{user.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 활동 피드 */}
                <div className="space-y-3">
                  {loading ? (
                    <p className="text-center text-gray-500 py-8">로딩 중...</p>
                  ) : activities.length > 0 ? (
                    activities.map((activity) => (
                      <div key={activity.id} className="p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl hover:shadow-md transition-all border border-pink-100">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold shadow-sm">
                            {activity.userName.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm leading-relaxed" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                              <span className="font-bold text-purple-600">{activity.userName}</span>
                              {activity.action}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <span>⏰</span>
                              {getTimeAgo(activity.timestamp)}
                            </p>
                          </div>
                          <span className="text-2xl">{activity.icon}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p>아직 활동이 없습니다</p>
                      <p className="text-xs mt-2">첫 활동을 등록해보세요! 🚀</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
