'use client';

import { useEffect, useState } from 'react';
import { Session } from 'next-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, LogOut, Settings, UserPlus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';

interface AdminDashboardProps {
  session: Session;
}

export default function AdminDashboard({ session }: AdminDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingUsers, setPendingUsers] = useState(0);

  useEffect(() => {
    const fetchPendingUsers = async () => {
      try {
        const response = await fetch('/api/admin/users?status=pending');
        const result = await response.json();
        if (result.success) {
          setPendingUsers(result.data.length);
        }
      } catch (error) {
        console.error('Error fetching pending users:', error);
      }
    };
    fetchPendingUsers();
  }, []);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/auth/signin');
  };

  const quickLinks = [
    { title: '사용자 관리', href: '/admin/users', icon: Users, description: '직원 계정 및 권한 관리', badge: pendingUsers > 0 ? pendingUsers : null },
    { title: '고객 배분', href: '/admin/allocation', icon: UserPlus, description: '고객을 직원에게 배분' },
    { title: '권한 설정', href: '/admin/settings', icon: ShieldCheck, description: '시스템 권한 관리' },
    { title: '시스템 설정', href: '/admin/settings', icon: Settings, description: '전체 시스템 설정' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">온시아 CRM</h1>
            <p className="text-sm text-gray-600">환영합니다, {session.user?.name}님 (관리자)</p>
          </div>
          <Button onClick={handleLogout} variant="outline"><LogOut className="mr-2 h-4 w-4" />로그아웃</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {pendingUsers > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">
              <strong>{pendingUsers}명</strong>의 직원이 승인 대기 중입니다.
              <Link href="/admin/users" className="ml-2 text-yellow-600 underline">지금 승인하기</Link>
            </p>
          </div>
        )}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">관리자 메뉴</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <Link key={index} href={link.href}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
                    <CardContent className="p-6">
                      {link.badge && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                          {link.badge}
                        </div>
                      )}
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
