import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 전체 직원 목록 (승인된 사용자만)
    const allUsers = await prisma.user.findMany({
      where: {
        approvedAt: { not: null }
      },
      select: { id: true, name: true },
    });

    const allUserIds = allUsers.map(u => u.id);
    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.name]));

    // 최근 활동 가져오기 (고객 등록, 통화 기록, 방문 일정)
    const activities: Array<{
      id: string;
      userName: string;
      action: string;
      timestamp: Date;
      icon: string;
    }> = [];

    // 1. 최근 통화 기록 (최근 30개)
    const recentCallLogs = await prisma.callLog.findMany({
      where: {
        userId: {
          in: allUserIds,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        userId: true,
        customer: {
          select: { name: true },
        },
        createdAt: true,
      },
    });

    recentCallLogs.forEach(callLog => {
      if (callLog.userId) {
        activities.push({
          id: `call-${callLog.id}`,
          userName: userMap[callLog.userId] || '알 수 없음',
          action: `고객 "${callLog.customer.name || '이름 없음'}"과(와) 통화를 완료했습니다`,
          timestamp: callLog.createdAt,
          icon: '📞',
        });
      }
    });

    // 2. 최근 방문 일정 (최근 30개)
    const recentVisits = await prisma.visitSchedule.findMany({
      where: {
        userId: {
          in: allUserIds,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        userId: true,
        customer: {
          select: { name: true },
        },
        visitDate: true,
        createdAt: true,
      },
    });

    recentVisits.forEach(visit => {
      if (visit.userId) {
        const visitDateStr = new Date(visit.visitDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
        const customerName = visit.customer.name || '이름 없음';
        activities.push({
          id: `visit-${visit.id}`,
          userName: userMap[visit.userId] || '알 수 없음',
          action: `님이 ${visitDateStr} ${customerName} 고객 방문일정 잡았습니다~ ❤️`,
          timestamp: visit.createdAt,
          icon: '📅',
        });
      }
    });

    // 시간순으로 정렬
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // 최근 30개만 반환
    const recentActivities = activities.slice(0, 30);

    return NextResponse.json({
      success: true,
      data: recentActivities,
    });
  } catch (error) {
    console.error('Error fetching team activities:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
