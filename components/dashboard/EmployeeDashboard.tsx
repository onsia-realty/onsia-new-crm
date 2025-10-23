'use client';

import { useEffect, useState } from 'react';
import { Session } from 'next-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, Calendar, Trophy, TrendingUp, Phone, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';

interface EmployeeStatistics {
  myCustomers: number;
  myCallsToday: number;
  myScheduledVisits: number;
  myMonthlyContracts: number;
}

interface TeamActivity {
  id: string;
  userName: string;
  action: string;
  timestamp: Date;
  icon: string;
}

interface EmployeeDashboardProps {
  session: Session;
}

export default function EmployeeDashboard({ session }: EmployeeDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [statistics, setStatistics] = useState<EmployeeStatistics | null>(null);
  const [activities, setActivities] = useState<TeamActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 통계 데이터 조회
        const statsResponse = await fetch('/api/statistics/employee');
        const statsResult = await statsResponse.json();
        if (statsResult.success) {
          setStatistics(statsResult.data);
        }

        // 팀 활동 피드 조회 (실시간)
        const activityResponse = await fetch('/api/activities/team');
        const activityResult = await activityResponse.json();
        if (activityResult.success) {
          setActivities(activityResult.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // 30초마다 활동 피드 새로고침
    const interval = setInterval(() => {
      fetch('/api/activities/team')
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            setActivities(result.data);
          }
        });
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
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

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* 좌측: 방문 일정 캘린더 (70%) */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
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
              <CardContent className="p-6">
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">캘린더 컴포넌트 영역</p>
                  <p className="text-sm mt-2">FullCalendar 또는 react-big-calendar 통합 예정</p>
                  <Button
                    onClick={() => router.push('/dashboard/schedules')}
                    className="mt-4"
                    variant="outline"
                  >
                    임시: 일정 페이지로 이동
                  </Button>
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
                  <div className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-md transition-shadow">
                    <input type="checkbox" className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium">오늘 예정 방문 고객 확인</p>
                      <p className="text-sm text-gray-600">
                        {statistics?.myScheduledVisits || 0}건의 방문 일정
                      </p>
                    </div>
                    <Button onClick={() => router.push('/dashboard/schedules')} variant="ghost" size="sm">
                      확인
                    </Button>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-md transition-shadow">
                    <input type="checkbox" className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium">고객 통화 및 기록 작성</p>
                      <p className="text-sm text-gray-600">오늘 {statistics?.myCallsToday || 0}건 완료</p>
                    </div>
                    <Button onClick={() => router.push('/dashboard/customers')} variant="ghost" size="sm">
                      작성
                    </Button>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-md transition-shadow">
                    <input type="checkbox" className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium">신규 고객 등록</p>
                      <p className="text-sm text-gray-600">새로운 고객을 시스템에 추가하세요</p>
                    </div>
                    <Button onClick={() => router.push('/dashboard/customers/new')} variant="ghost" size="sm">
                      등록
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 우측: 실시간 활동 피드 (30%) */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* 이번 주 TOP 직원 */}
            <Card className="shadow-lg bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
              <CardHeader className="border-b bg-yellow-100/50">
                <CardTitle className="flex items-center gap-2 text-yellow-800">
                  <Trophy className="h-5 w-5" />
                  이번 주 TOP 직원
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">김철수</p>
                      <p className="text-xs text-gray-600">방문 15건 · 계약 3건</p>
                    </div>
                    <p className="text-yellow-600 font-bold">120점</p>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">이영희</p>
                      <p className="text-xs text-gray-600">방문 12건 · 계약 2건</p>
                    </div>
                    <p className="text-gray-600 font-bold">100점</p>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center text-white font-bold">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">박민수</p>
                      <p className="text-xs text-gray-600">방문 10건 · 계약 2건</p>
                    </div>
                    <p className="text-orange-600 font-bold">90점</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 실시간 팀 활동 피드 */}
            <Card className="shadow-lg sticky top-24">
              <CardHeader className="bg-blue-50 border-b">
                <CardTitle className="text-blue-700">🔥 팀 활동 피드 (실시간)</CardTitle>
                <p className="text-xs text-gray-600 mt-1">다른 직원들이 뭐하고 있을까요?</p>
              </CardHeader>
              <CardContent className="p-4 max-h-[600px] overflow-y-auto">
                <div className="space-y-3">
                  {loading ? (
                    <p className="text-center text-gray-500 py-8">로딩 중...</p>
                  ) : activities.length > 0 ? (
                    activities.map((activity) => (
                      <div key={activity.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                            {activity.userName.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm">
                              <span className="font-semibold text-blue-600">{activity.userName}</span>
                              {' '}{activity.action}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {getTimeAgo(activity.timestamp)}
                            </p>
                          </div>
                          <span className="text-lg">{activity.icon}</span>
                        </div>
                        {/* 좋아요/댓글 기능 (추후 구현) */}
                        <div className="flex gap-3 mt-2 ml-10">
                          <button className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1">
                            ❤️ <span>0</span>
                          </button>
                          <button className="text-xs text-gray-500 hover:text-blue-500 flex items-center gap-1">
                            💬 <span>0</span>
                          </button>
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
