'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Role } from '@prisma/client';

// 역할별 대시보드 컴포넌트 import
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import TeamLeaderDashboard from '@/components/dashboard/TeamLeaderDashboard';
import HeadDashboard from '@/components/dashboard/HeadDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import CeoDashboard from '@/components/dashboard/CeoDashboard';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // 비밀번호 변경 필수 체크
    if (session.user?.passwordResetRequired) {
      router.push('/auth/change-password');
    }
  }, [session, status, router]);

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

  // 역할별 대시보드 렌더링
  const userRole = session.user?.role as Role;

  switch (userRole) {
    case 'CEO':
      return <CeoDashboard session={session} />;
    case 'ADMIN':
      return <AdminDashboard session={session} />;
    case 'HEAD':
      return <HeadDashboard session={session} />;
    case 'TEAM_LEADER':
      return <TeamLeaderDashboard session={session} />;
    case 'EMPLOYEE':
      return <EmployeeDashboard session={session} />;
    default:
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl text-gray-600">승인 대기 중입니다.</p>
            <p className="text-sm text-gray-500 mt-2">관리자의 승인을 기다려주세요.</p>
          </div>
        </div>
      );
  }
}
