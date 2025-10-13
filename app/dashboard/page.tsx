'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Phone, Calendar, TrendingUp, LogOut, Settings, UserPlus, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface Statistics {
  totalCustomers: number;
  todayCallLogs: number;
  scheduledVisits: number;
  monthlyContracts: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
    }
  }, [session, status, router]);

  // 통계 데이터 조회
  useEffect(() => {
    if (!session) return;

    const fetchStatistics = async () => {
      try {
        setStatsLoading(true);
        const response = await fetch('/api/statistics');
        const result = await response.json();

        if (result.success) {
          setStatistics(result.data);
        } else {
          console.error('Failed to fetch statistics:', result.error);
        }
      } catch (error) {
        console.error('Error fetching statistics:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStatistics();
  }, [session]);

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
      toast({
        title: '로그아웃',
        description: '성공적으로 로그아웃되었습니다.',
      });
      router.push('/auth/signin');
    } catch (error) {
      toast({
        title: '오류',
        description: '로그아웃 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const stats = [
    {
      title: '전체 고객',
      value: statsLoading ? '...' : statistics?.totalCustomers.toLocaleString() || '0',
      icon: Users
    },
    {
      title: '오늘 통화',
      value: statsLoading ? '...' : statistics?.todayCallLogs.toLocaleString() || '0',
      icon: Phone
    },
    {
      title: '예정 방문',
      value: statsLoading ? '...' : statistics?.scheduledVisits.toLocaleString() || '0',
      icon: Calendar
    },
    {
      title: '월 계약',
      value: statsLoading ? '...' : statistics?.monthlyContracts.toLocaleString() || '0',
      icon: TrendingUp
    },
  ];

  const quickLinks = [
    { title: '사용자 관리', href: '/admin/users', icon: Users, description: '직원 계정 관리 및 권한 설정' },
    { title: '고객 배분', href: '/admin/allocation', icon: UserPlus, description: '고객을 직원에게 배분' },
    { title: '시스템 설정', href: '/admin/settings', icon: Settings, description: '시스템 전반 설정 관리' },
    { title: '고객 목록', href: '/dashboard/customers', icon: ClipboardList, description: '전체 고객 목록 조회' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">온시아 CRM</h1>
            <p className="text-sm text-gray-600">환영합니다, {session.user?.name || '사용자'}님</p>
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
                  {statsLoading && (
                    <p className="text-xs text-gray-500 mt-1">데이터 로딩 중...</p>
                  )}
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
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
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

        {/* 최근 활동 */}
        <Card>
          <CardHeader>
            <CardTitle>최근 활동</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">김철수님이 새로운 고객을 등록했습니다</p>
                  <p className="text-sm text-gray-600">5분 전</p>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">이영희님이 고객과 통화를 기록했습니다</p>
                  <p className="text-sm text-gray-600">15분 전</p>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">박민수님이 방문 일정을 추가했습니다</p>
                  <p className="text-sm text-gray-600">30분 전</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}