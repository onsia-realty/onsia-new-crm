'use client';

import { useEffect, useState } from 'react';
import { Session } from 'next-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogOut, Calendar, TrendingUp, Phone, Users, Camera, PhoneCall, Plus, Trash2, Check, MoreVertical, FileText, Home, Bell, ScanText, CreditCard, Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import VisitCalendar from './VisitCalendar';
import SimpleChatRoom from '@/components/discussions/SimpleChatRoom';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import Link from 'next/link';

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

interface EmployeeDashboardProps {
  session: Session;
}

export default function EmployeeDashboard({ session }: EmployeeDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [statistics, setStatistics] = useState<EmployeeStatistics | null>(null);
  const [teamVisits, setTeamVisits] = useState<TeamVisitActivity[]>([]);
  const [adCalls, setAdCalls] = useState<AdCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalTodos, setPersonalTodos] = useState<PersonalTodo[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [myRank, setMyRank] = useState<{
    rank: number;
    totalScore: number;
    totalPeers: number;
  } | null>(null);

  // 리더보드에서 내 순위 가져오기 (이번 주 기준)
  useEffect(() => {
    fetch('/api/leaderboard?period=week')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.myRank) {
          setMyRank({
            rank: json.data.myRank.rank,
            totalScore: json.data.myRank.totalScore,
            totalPeers: json.data.rankings.length,
          });
        }
      })
      .catch(() => {});
  }, []);

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
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchData = async () => {
      setLoading(true);

      // 각 API를 독립적으로 호출 (하나가 실패해도 다른 것은 계속 실행)
      try {
        const statsResponse = await fetch('/api/statistics/employee', { signal });
        if (!statsResponse.ok) {
          throw new Error(`HTTP error! status: ${statsResponse.status}`);
        }
        const statsResult = await statsResponse.json();
        if (statsResult.success) {
          setStatistics(statsResult.data);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
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
        const teamVisitsResponse = await fetch('/api/activities/team-visits', { signal });
        if (!teamVisitsResponse.ok) {
          throw new Error(`HTTP error! status: ${teamVisitsResponse.status}`);
        }
        const teamVisitsResult = await teamVisitsResponse.json();
        if (teamVisitsResult.success) {
          setTeamVisits(teamVisitsResult.data);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }

      try {
        const adCallsResponse = await fetch('/api/ad-calls?status=ASSIGNED', { signal });
        if (!adCallsResponse.ok) {
          throw new Error(`HTTP error! status: ${adCallsResponse.status}`);
        }
        const adCallsResult = await adCallsResponse.json();
        if (adCallsResult.success) {
          setAdCalls(adCallsResult.data || []);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setAdCalls([]);
      }

      setLoading(false);
    };

    fetchData();

    // 30초마다 활동 피드 및 온라인 사용자 새로고침
    const interval = setInterval(() => {
      if (signal.aborted) return;

      // 각 API를 독립적으로 호출 (하나가 실패해도 다른 것은 계속 실행)
      fetch('/api/activities/team-visits', { signal })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then(result => {
          if (result.success) {
            setTeamVisits(result.data);
          }
        })
        .catch(() => { /* Silently ignore errors in interval refresh */ });
    }, 30000);

    return () => {
      abortController.abort();
      clearInterval(interval);
    };
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
        <div className="px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="flex h-16 items-center justify-center border-b text-lg font-bold">
                  온시아 CRM
                </SheetTitle>
                <SheetDescription className="sr-only">
                  메인 네비게이션 메뉴
                </SheetDescription>

                {/* 업무보고 바로가기 */}
                <div className="h-16 border-b bg-gradient-to-r from-blue-50 to-blue-100">
                  <Link
                    href="/dashboard/reports"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between h-full px-4 hover:bg-blue-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-blue-900">업무보고</span>
                    </div>
                    <span className="text-xs text-blue-600">바로가기 →</span>
                  </Link>
                </div>

                {/* 메인 메뉴 */}
                <nav className="space-y-1 p-4">
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Home className="mr-3 h-5 w-5" />
                    홈
                  </Link>
                  <Link
                    href="/dashboard/customers"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Users className="mr-3 h-5 w-5" />
                    고객
                  </Link>
                  <Link
                    href="/dashboard/schedules"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Calendar className="mr-3 h-5 w-5" />
                    일정
                  </Link>
                  <Link
                    href="/dashboard/notices"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Bell className="mr-3 h-5 w-5" />
                    공지
                  </Link>
                  <Link
                    href="/dashboard/ocr"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <ScanText className="mr-3 h-5 w-5" />
                    이미지 OCR
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
            <h1 className="text-base md:text-xl font-bold text-gray-900 whitespace-nowrap">온시아 CRM</h1>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink min-w-0">
            <span className="text-[11px] md:text-xs text-gray-600 truncate max-w-[120px] md:max-w-none">
              {session.user?.name} {
                session.user?.role === 'TEAM_LEADER' ? '팀장' :
                session.user?.role === 'HEAD' ? '본부장' :
                session.user?.role === 'ADMIN' ? '관리자' :
                session.user?.role === 'CEO' ? '대표' : '직원'
              }님
            </span>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="h-8 px-2 md:px-3 flex-shrink-0">
              <LogOut className="h-3.5 w-3.5 md:h-4 md:w-4 md:mr-1" />
              <span className="hidden md:inline">로그아웃</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 헤더 높이만큼 여백 추가 */}
      <div className="h-16"></div>

      <main className="container mx-auto px-4 py-6">
        {/* 모바일 빠른 액세스 (모바일에서만 표시) */}
        <div className="mb-6 lg:hidden space-y-4">
          {/* 업무보고 바로가기 */}
          <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">업무보고</h3>
                    <p className="text-sm text-white/80">오늘의 업무 기록</p>
                  </div>
                </div>
                <Button
                  onClick={() => router.push('/dashboard/reports')}
                  variant="secondary"
                  className="bg-white text-blue-600 hover:bg-white/90"
                >
                  작성하기
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 이미지 OCR */}
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
            {/* 내 리더보드 순위 (이번 주) */}
            {myRank && (
              <Card
                className="shadow-lg bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-200 cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => router.push('/dashboard/leaderboard')}
              >
                <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-8 w-8 text-amber-500" />
                    <div>
                      <p className="text-xs font-medium text-amber-700">이번 주 내 순위</p>
                      <p className="text-2xl font-bold text-amber-900">
                        {myRank.rank}위{' '}
                        <span className="text-sm font-normal text-amber-700">
                          / {myRank.totalPeers}명 중
                        </span>
                        {myRank.rank === 1 && ' 🥇'}
                        {myRank.rank === 2 && ' 🥈'}
                        {myRank.rank === 3 && ' 🥉'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-700">종합 점수</p>
                    <p className="text-2xl font-bold text-amber-900">
                      {myRank.totalScore.toLocaleString()}
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">리더보드 보기 →</p>
                  </div>
                </CardContent>
              </Card>
            )}

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

                    {/* 왕십리 어반홈스 */}
                    <button
                      onClick={() => router.push('/dashboard/customers?site=왕십리 어반홈스')}
                      className="bg-white border-2 border-orange-200 rounded-lg p-4 hover:bg-orange-50 cursor-pointer transition-all hover:shadow-md text-left"
                    >
                      <div className="text-2xl mb-1">🏗️</div>
                      <div className="font-semibold text-gray-900 text-sm mb-1">왕십리 어반홈스</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {statistics.customersBySite['왕십리 어반홈스'] || 0}
                      </div>
                      <div className="text-xs text-gray-600">고객</div>
                    </button>

                    {/* 관리자 배분 */}
                    <button
                      onClick={() => router.push('/dashboard/customers?site=관리자 배분')}
                      className="bg-white border-2 border-rose-200 rounded-lg p-4 hover:bg-rose-50 cursor-pointer transition-all hover:shadow-md text-left"
                    >
                      <div className="text-2xl mb-1">👔</div>
                      <div className="font-semibold text-gray-900 text-sm mb-1">관리자 배분</div>
                      <div className="text-2xl font-bold text-rose-600">
                        {statistics.customersBySite['관리자 배분'] || 0}
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

          {/* 우측: 온시아 채팅 (30%) */}
          <div className="col-span-12 lg:col-span-4">
            <div className="sticky top-24">
              <SimpleChatRoom />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
