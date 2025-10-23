'use client';

import { useEffect, useState } from 'react';
import { Session } from 'next-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Phone, Calendar, TrendingUp, LogOut, BarChart3, UserCog } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';

interface TeamLeaderStatistics {
  teamCustomers: number;
  teamCallsToday: number;
  teamScheduledVisits: number;
  teamMonthlyContracts: number;
  teamMemberCount: number;
}

interface TeamLeaderDashboardProps {
  session: Session;
}

export default function TeamLeaderDashboard({ session }: TeamLeaderDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [statistics, setStatistics] = useState<TeamLeaderStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/statistics/team-leader');
        const result = await response.json();

        if (result.success) {
          setStatistics(result.data);
        }
      } catch (error) {
        console.error('Error fetching statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, []);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    toast({
      title: '로그아웃',
      description: '성공적으로 로그아웃되었습니다.',
    });
    router.push('/auth/signin');
  };

  const stats = [
    {
      title: '팀 고객',
      value: loading ? '...' : statistics?.teamCustomers.toLocaleString() || '0',
      icon: Users,
      description: '팀 전체 고객 수'
    },
    {
      title: '팀 통화 (오늘)',
      value: loading ? '...' : statistics?.teamCallsToday.toLocaleString() || '0',
      icon: Phone,
      description: '팀 전체 통화'
    },
    {
      title: '팀 방문 예정',
      value: loading ? '...' : statistics?.teamScheduledVisits.toLocaleString() || '0',
      icon: Calendar,
      description: '예정된 방문'
    },
    {
      title: '팀 계약 (월)',
      value: loading ? '...' : statistics?.teamMonthlyContracts.toLocaleString() || '0',
      icon: TrendingUp,
      description: '이번 달 계약'
    },
  ];

  const quickLinks = [
    {
      title: '팀 고객 관리',
      href: '/dashboard/customers',
      icon: Users,
      description: '팀 전체 고객 조회'
    },
    {
      title: '팀원 관리',
      href: '/dashboard/team/members',
      icon: UserCog,
      description: '팀원 현황 및 관리'
    },
    {
      title: '팀 실적 통계',
      href: '/dashboard/stats',
      icon: BarChart3,
      description: '팀 성과 분석'
    },
    {
      title: '방문 일정',
      href: '/dashboard/schedules',
      icon: Calendar,
      description: '팀 방문 일정'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">온시아 CRM</h1>
            <p className="text-sm text-gray-600">환영합니다, {session.user?.name}님 (팀장)</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            로그아웃
          </Button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="container mx-auto px-4 py-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 빠른 링크 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">빠른 메뉴</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <Link key={index} href={link.href}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardContent className="p-6">
                      <Icon className="h-8 w-8 text-blue-600 mb-3" />
                      <h3 className="font-semibold text-gray-900 mb-1">{link.title}</h3>
                      <p className="text-sm text-gray-600">{link.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 팀원별 성과 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>팀원별 성과 (이번 달)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <p className="text-gray-500 text-center py-4">데이터 로딩 중...</p>
              ) : (
                <>
                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">1</span>
                      </div>
                      <div>
                        <p className="font-medium">팀원 이름</p>
                        <p className="text-sm text-gray-600">고객: 25명 | 계약: 5건</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">5건</p>
                      <p className="text-xs text-gray-500">이번 달</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 text-center py-2">
                    팀원 데이터는 API 연동 후 표시됩니다
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 주간 팀 목표 */}
        <Card>
          <CardHeader>
            <CardTitle>이번 주 팀 목표</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">신규 고객 등록</span>
                  <span className="text-sm font-medium">15 / 30</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '50%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">계약 성사</span>
                  <span className="text-sm font-medium">8 / 10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '80%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">방문 완료</span>
                  <span className="text-sm font-medium">20 / 40</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '50%' }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
