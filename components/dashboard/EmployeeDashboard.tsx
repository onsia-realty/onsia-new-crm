'use client';

import { useEffect, useState } from 'react';
import { Session } from 'next-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogOut, Calendar, TrendingUp, Phone, Users, Camera, PhoneCall, Plus, Trash2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import VisitCalendar from './VisitCalendar';

interface PersonalTodo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

interface EmployeeStatistics {
  myCustomers: number;
  myCallsToday: number;
  myScheduledVisits: number;
  myMonthlyContracts: number;
  myNewCustomersToday: number;
  myInterestCardsToday: number;
  todayVisits: number;
  ocrCustomersToday: number;
  customersBySite?: Record<string, number>;
}

interface AdCall {
  id: string;
  phone: string;
  source?: string;
  siteName?: string;
  receivedAt: Date;
  status: 'PENDING' | 'ASSIGNED' | 'CONVERTED' | 'INVALID';
  assignedAt?: Date;
  notes?: string;
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
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [adCalls, setAdCalls] = useState<AdCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalTodos, setPersonalTodos] = useState<PersonalTodo[]>([]);
  const [newTodoText, setNewTodoText] = useState('');

  // 개인 메모장 로드/저장
  useEffect(() => {
    const saved = localStorage.getItem(`personalTodos_${session.user.id}`);
    if (saved) {
      setPersonalTodos(JSON.parse(saved));
    }
  }, [session.user.id]);

  const saveTodos = (todos: PersonalTodo[]) => {
    localStorage.setItem(`personalTodos_${session.user.id}`, JSON.stringify(todos));
    setPersonalTodos(todos);
  };

  const addTodo = () => {
    if (!newTodoText.trim()) return;
    const newTodo: PersonalTodo = {
      id: Date.now().toString(),
      text: newTodoText.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };
    saveTodos([newTodo, ...personalTodos]);
    setNewTodoText('');
  };

  const toggleTodo = (id: string) => {
    const updated = personalTodos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    saveTodos(updated);
  };

  const deleteTodo = (id: string) => {
    saveTodos(personalTodos.filter(todo => todo.id !== id));
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // 각 API를 독립적으로 호출 (하나가 실패해도 다른 것은 계속 실행)
      try {
        const statsResponse = await fetch('/api/statistics/employee');
        if (!statsResponse.ok) {
          throw new Error(`HTTP error! status: ${statsResponse.status}`);
        }
        const statsResult = await statsResponse.json();
        if (statsResult.success) {
          setStatistics(statsResult.data);
        } else {
          console.error('Employee statistics API returned error:', statsResult.error);
        }
      } catch (error) {
        console.error('Error fetching employee statistics:', error);
        // 기본값 설정
        setStatistics({
          myCustomers: 0,
          myCallsToday: 0,
          myScheduledVisits: 0,
          myMonthlyContracts: 0,
          myNewCustomersToday: 0,
          myInterestCardsToday: 0,
          todayVisits: 0,
          ocrCustomersToday: 0,
        });
      }

      try {
        const activityResponse = await fetch('/api/activities/team');
        if (!activityResponse.ok) {
          throw new Error(`HTTP error! status: ${activityResponse.status}`);
        }
        const activityResult = await activityResponse.json();
        if (activityResult.success) {
          setActivities(activityResult.data);
        } else {
          console.error('Team activities API returned error:', activityResult.error);
        }
      } catch (error) {
        console.error('Error fetching team activities:', error);
      }

      try {
        const teamVisitsResponse = await fetch('/api/activities/team-visits');
        if (!teamVisitsResponse.ok) {
          throw new Error(`HTTP error! status: ${teamVisitsResponse.status}`);
        }
        const teamVisitsResult = await teamVisitsResponse.json();
        if (teamVisitsResult.success) {
          setTeamVisits(teamVisitsResult.data);
        } else {
          console.error('Team visits API returned error:', teamVisitsResult.error);
        }
      } catch (error) {
        console.error('Error fetching team visits:', error);
      }

      try {
        const onlineResponse = await fetch('/api/users/online');
        if (!onlineResponse.ok) {
          throw new Error(`HTTP error! status: ${onlineResponse.status}`);
        }
        const onlineResult = await onlineResponse.json();
        if (onlineResult.success) {
          setOnlineUsers(onlineResult.data || []);
        } else {
          console.error('Online users API returned error:', onlineResult.error);
        }
      } catch (error) {
        console.error('Error fetching online users:', error);
        setOnlineUsers([]);
      }

      try {
        const adCallsResponse = await fetch('/api/ad-calls?status=ASSIGNED');
        if (!adCallsResponse.ok) {
          throw new Error(`HTTP error! status: ${adCallsResponse.status}`);
        }
        const adCallsResult = await adCallsResponse.json();
        if (adCallsResult.success) {
          setAdCalls(adCallsResult.data || []);
        } else {
          console.error('Ad calls API returned error:', adCallsResult.error);
        }
      } catch (error) {
        console.error('Error fetching ad calls:', error);
        setAdCalls([]);
      }

      setLoading(false);
    };

    fetchData();

    // 30초마다 활동 피드 및 온라인 사용자 새로고침
    const interval = setInterval(async () => {
      // 각 API를 독립적으로 호출 (하나가 실패해도 다른 것은 계속 실행)
      fetch('/api/activities/team')
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then(result => {
          if (result.success) {
            setActivities(result.data);
          }
        })
        .catch(err => console.error('Error in team activities refresh:', err));

      fetch('/api/activities/team-visits')
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then(result => {
          if (result.success) {
            setTeamVisits(result.data);
          }
        })
        .catch(err => console.error('Error in team visits refresh:', err));

      fetch('/api/users/online')
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then(result => {
          if (result.success) {
            setOnlineUsers(result.data || []);
          }
        })
        .catch(err => console.error('Error in online users refresh:', err));
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
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">온시아 CRM</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 hidden sm:inline">{session.user?.name}님</span>
            <Button onClick={() => router.push('/dashboard/customers')} variant="outline" size="sm">
              <Users className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">내 고객</span>
            </Button>
            <Button onClick={() => router.push('/dashboard/cards')} variant="outline" size="sm">
              <Calendar className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">관심카드</span>
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm">
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">로그아웃</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 헤더 높이만큼 여백 추가 */}
      <div className="h-16"></div>

      <main className="container mx-auto px-4 py-6">
        {/* 모바일 OCR 빠른 액세스 (모바일에서만 표시) */}
        <div className="mb-6 lg:hidden">
          <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Camera className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">이미지 OCR</h3>
                    <p className="text-sm text-white/80">빠른 고객 등록</p>
                  </div>
                </div>
                <Button
                  onClick={() => router.push('/dashboard/ocr')}
                  variant="secondary"
                  className="bg-white text-indigo-600 hover:bg-white/90"
                >
                  시작하기
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-12 gap-6">
          {/* 좌측: 방문 일정 캘린더 (70%) */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* 현장별 DB 현황 */}
            {statistics?.customersBySite && Object.keys(statistics.customersBySite).length > 0 && (
              <Card className="shadow-lg bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
                <CardHeader className="border-b bg-indigo-100/50 py-3">
                  <CardTitle className="flex items-center gap-2 text-indigo-800 text-sm">
                    <Calendar className="h-4 w-4" />
                    현장별 DB 현황
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* 용인경남아너스빌 */}
                    <button
                      onClick={() => router.push('/dashboard/customers?site=용인경남아너스빌')}
                      className="bg-white border-2 border-blue-200 rounded-lg p-4 hover:bg-blue-50 cursor-pointer transition-all hover:shadow-md text-left"
                    >
                      <div className="text-2xl mb-1">🏢</div>
                      <div className="font-semibold text-gray-900 text-sm mb-1">용인경남아너스빌</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {statistics.customersBySite['용인경남아너스빌'] || 0}
                      </div>
                      <div className="text-xs text-gray-600">고객</div>
                    </button>

                    {/* 신광교클라우드시티 */}
                    <button
                      onClick={() => router.push('/dashboard/customers?site=신광교클라우드시티')}
                      className="bg-white border-2 border-green-200 rounded-lg p-4 hover:bg-green-50 cursor-pointer transition-all hover:shadow-md text-left"
                    >
                      <div className="text-2xl mb-1">🏙️</div>
                      <div className="font-semibold text-gray-900 text-sm mb-1">신광교클라우드시티</div>
                      <div className="text-2xl font-bold text-green-600">
                        {statistics.customersBySite['신광교클라우드시티'] || 0}
                      </div>
                      <div className="text-xs text-gray-600">고객</div>
                    </button>

                    {/* 평택 로제비앙 */}
                    <button
                      onClick={() => router.push('/dashboard/customers?site=평택 로제비앙')}
                      className="bg-white border-2 border-purple-200 rounded-lg p-4 hover:bg-purple-50 cursor-pointer transition-all hover:shadow-md text-left"
                    >
                      <div className="text-2xl mb-1">🏘️</div>
                      <div className="font-semibold text-gray-900 text-sm mb-1">평택 로제비앙</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {statistics.customersBySite['평택 로제비앙'] || 0}
                      </div>
                      <div className="text-xs text-gray-600">고객</div>
                    </button>

                    {/* 미지정 */}
                    <button
                      onClick={() => router.push('/dashboard/customers?site=미지정')}
                      className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-all hover:shadow-md text-left"
                    >
                      <div className="text-2xl mb-1">📍</div>
                      <div className="font-semibold text-gray-900 text-sm mb-1">미지정</div>
                      <div className="text-2xl font-bold text-gray-600">
                        {statistics.customersBySite['미지정'] || 0}
                      </div>
                      <div className="text-xs text-gray-600">고객</div>
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 배정받은 광고콜 */}
            <Card className="shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader className="border-b bg-green-100/50 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-green-800 text-sm">
                    <PhoneCall className="h-4 w-4" />
                    배정받은 광고콜
                  </CardTitle>
                  <Button
                    onClick={() => router.push('/dashboard/ad-calls')}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    전체 보기
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 max-h-[200px] overflow-y-auto">
                {loading ? (
                  <p className="text-center text-gray-500 py-2 text-sm">로딩 중...</p>
                ) : adCalls.length > 0 ? (
                  <div className="space-y-2">
                    {adCalls.slice(0, 3).map((adCall) => (
                      <div
                        key={adCall.id}
                        className="p-2 bg-white rounded-lg shadow-sm border border-green-100 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <PhoneCall className="h-3 w-3 text-green-600" />
                            <p className="font-semibold text-xs text-gray-900">
                              {adCall.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                            </p>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            adCall.status === 'ASSIGNED'
                              ? 'bg-blue-100 text-blue-700'
                              : adCall.status === 'CONVERTED'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {adCall.status === 'ASSIGNED' ? '배정됨' :
                             adCall.status === 'CONVERTED' ? '전환완료' :
                             adCall.status === 'INVALID' ? '무효' : '대기중'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
                          <span>{adCall.siteName || adCall.source || '-'}</span>
                          <span className="text-gray-500">
                            {new Date(adCall.receivedAt).toLocaleDateString('ko-KR', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {adCalls.length > 3 && (
                      <p className="text-xs text-center text-gray-500">
                        외 {adCalls.length - 3}건
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-400">
                    <PhoneCall className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-xs">배정받은 광고콜이 없습니다</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 개인 방문 일정 - 모바일에서 광고콜 아래 표시 */}
            <Card className="shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <CardHeader className="border-b bg-blue-100/50 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-blue-800 text-sm">
                    <Calendar className="h-4 w-4" />
                    개인 방문 일정
                  </CardTitle>
                  <Button
                    onClick={() => router.push('/dashboard/schedules')}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    등록하기
                  </Button>
                </div>
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
                        className="p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-blue-100"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm text-blue-900">
                              {visit.customerName}
                            </p>
                            <p className="text-xs text-gray-600">
                              {new Date(visit.visitDate).toLocaleDateString('ko-KR', {
                                month: 'long',
                                day: 'numeric',
                                weekday: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500">
                            {getTimeAgo(visit.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <Calendar className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">최근 7일 내 방문 일정이 없습니다</p>
                    <Button
                      onClick={() => router.push('/dashboard/schedules')}
                      size="sm"
                      variant="link"
                      className="mt-2 text-xs"
                    >
                      방문 일정 등록하기
                    </Button>
                  </div>
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

            {/* 방문 일정 캘린더 - PC에서만 표시 */}
            <Card className="shadow-lg hidden md:block">
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
                <VisitCalendar />
              </CardContent>
            </Card>

            {/* 개인 메모장 */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50">
                <CardTitle className="text-orange-700">📝 오늘 할 일 메모</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                {/* 새 할 일 추가 */}
                <div className="flex gap-2 mb-4">
                  <Input
                    value={newTodoText}
                    onChange={(e) => setNewTodoText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                    placeholder="할 일을 입력하세요..."
                    className="flex-1"
                  />
                  <Button onClick={addTodo} size="sm" className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* 할 일 목록 */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {personalTodos.length > 0 ? (
                    personalTodos.map((todo) => (
                      <div
                        key={todo.id}
                        className={`flex items-center gap-3 p-3 bg-white border rounded-lg transition-all ${
                          todo.completed ? 'bg-gray-50 border-gray-200' : 'hover:shadow-md'
                        }`}
                      >
                        <button
                          onClick={() => toggleTodo(todo.id)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            todo.completed
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {todo.completed && <Check className="h-3 w-3" />}
                        </button>
                        <span
                          className={`flex-1 text-sm ${
                            todo.completed ? 'line-through text-gray-400' : 'text-gray-700'
                          }`}
                        >
                          {todo.text}
                        </span>
                        <button
                          onClick={() => deleteTodo(todo.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">할 일이 없습니다</p>
                      <p className="text-xs mt-1">위에서 새 할 일을 추가하세요</p>
                    </div>
                  )}
                </div>

                {/* 완료 현황 */}
                {personalTodos.length > 0 && (
                  <div className="mt-4 pt-3 border-t text-center">
                    <span className="text-sm text-gray-600">
                      완료: <span className="font-semibold text-green-600">
                        {personalTodos.filter(t => t.completed).length}
                      </span> / {personalTodos.length}건
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 우측: 실시간 활동 피드 (30%) */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
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
