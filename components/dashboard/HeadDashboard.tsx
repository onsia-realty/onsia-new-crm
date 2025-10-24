'use client';

import { Session } from 'next-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, LogOut, BarChart3, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';

interface HeadDashboardProps {
  session: Session;
}

export default function HeadDashboard({ session }: HeadDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/auth/signin');
  };

  const quickLinks = [
    { title: '본부 통계', href: '/dashboard/stats', icon: BarChart3, description: '본부 전체 통계' },
    { title: '팀 관리', href: '/dashboard/teams', icon: Building2, description: '팀 현황 관리' },
    { title: '고객 관리', href: '/dashboard/customers', icon: Users, description: '본부 고객 조회' },
    { title: '실적 분석', href: '/dashboard/analytics', icon: TrendingUp, description: '본부 실적 분석' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">온시아 CRM</h1>
            <p className="text-sm text-gray-600">환영합니다, {session.user?.name}님 (본부장)</p>
          </div>
          <Button onClick={handleLogout} variant="outline"><LogOut className="mr-2 h-4 w-4" />로그아웃</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
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
      </main>
    </div>
  );
}
