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

    // 최근 활동 가져오기 (방문 일정, 관심카드만 - 통화 기록 제외)
    const activities: Array<{
      id: string;
      userName: string;
      action: string;
      timestamp: Date;
      icon: string;
    }> = [];

    // 1. 최근 방문 일정 (최근 30개)
    const recentVisits = await prisma.visitSchedule.findMany({
      where: {
        userId: {
          in: allUserIds,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
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

    // 2. 최근 관심카드 등록 (최근 30개)
    const recentInterestCards = await prisma.interestCard.findMany({
      where: {
        userId: {
          in: allUserIds,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        userId: true,
        customer: {
          select: { name: true },
        },
        createdAt: true,
      },
    });

    recentInterestCards.forEach(card => {
      if (card.userId) {
        const customerName = card.customer.name || '이름 없음';
        activities.push({
          id: `card-${card.id}`,
          userName: userMap[card.userId] || '알 수 없음',
          action: `님이 ${customerName} 고객의 관심카드를 등록했습니다 💖`,
          timestamp: card.createdAt,
          icon: '📋',
        });
      }
    });

    // 3. 최근 대량 등록 (AuditLog에서 가져오기)
    const recentBulkImports = await prisma.auditLog.findMany({
      where: {
        userId: {
          in: allUserIds,
        },
        action: 'CREATE',
        entity: 'Customer',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        userId: true,
        changes: true,
        createdAt: true,
      },
    });

    recentBulkImports.forEach(log => {
      if (log.userId && log.changes && typeof log.changes === 'object') {
        const changes = log.changes as { success?: number; total?: number };
        const successCount = changes.success || 0;

        // 대량 등록만 표시 (단건 등록 제외)
        if (successCount >= 5) {
          activities.push({
            id: `bulk-${log.id}`,
            userName: userMap[log.userId] || '알 수 없음',
            action: `님이 고객 대량 등록 ${successCount}건 완료했습니다 🎉`,
            timestamp: log.createdAt,
            icon: '📦',
          });
        }
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
