'use client';

import { Session } from 'next-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, BarChart3, Building2, Users, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

interface CeoDashboardProps {
  session: Session;
}

export default function CeoDashboard({ session }: CeoDashboardProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/auth/signin');
  };

  const quickLinks = [
    { title: '경영 대시보드', href: '/dashboard/stats', icon: BarChart3, description: '전사 경영 지표' },
    { title: '조직 관리', href: '/admin/users', icon: Building2, description: '전사 조직 현황' },
    { title: '고객 현황', href: '/dashboard/customers', icon: Users, description: '전체 고객 조회' },
    { title: '실적 분석', href: '/dashboard/analytics', icon: TrendingUp, description: '전사 실적 분석' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">온시아 CRM</h1>
            <p className="text-sm text-gray-600">환영합니다, {session.user?.name}님 (대표)</p>
          </div>
          <Button onClick={handleLogout} variant="outline"><LogOut className="mr-2 h-4 w-4" />로그아웃</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">경영 메뉴</h2>
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
