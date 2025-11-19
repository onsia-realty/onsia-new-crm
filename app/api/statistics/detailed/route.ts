import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/statistics/detailed - 상세 통계 정보 조회
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한별 필터 조건
    const isEmployee = session.user.role === 'EMPLOYEE';
    const customerFilter = isEmployee ? { assignedUserId: session.user.id } : {};

    // 1. 현장별 고객 DB 현황
    const customersBySite = await prisma.customer.groupBy({
      by: ['assignedSite'],
      where: customerFilter,
      _count: {
        id: true,
      },
    });

    const siteData = customersBySite.map((item) => ({
      name: item.assignedSite || '미지정',
      value: item._count.id,
    })).sort((a, b) => b.value - a.value);

    // 2. DB 업데이트 현황 (어제/오늘/이번주)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 이번주 일요일

    // 오늘 등록된 고객
    const todayCustomers = await prisma.customer.count({
      where: {
        ...customerFilter,
        createdAt: { gte: today },
      },
    });

    // 어제 등록된 고객
    const yesterdayCustomers = await prisma.customer.count({
      where: {
        ...customerFilter,
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
    });

    // 이번주 등록된 고객
    const weekCustomers = await prisma.customer.count({
      where: {
        ...customerFilter,
        createdAt: { gte: weekStart },
      },
    });

    // 오늘 통화 기록
    const todayCalls = await prisma.callLog.count({
      where: {
        createdAt: { gte: today },
        ...(isEmployee && { userId: session.user.id }),
      },
    });

    // 어제 통화 기록
    const yesterdayCalls = await prisma.callLog.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: today,
        },
        ...(isEmployee && { userId: session.user.id }),
      },
    });

    // 이번주 통화 기록
    const weekCalls = await prisma.callLog.count({
      where: {
        createdAt: { gte: weekStart },
        ...(isEmployee && { userId: session.user.id }),
      },
    });

    const dbUpdateStats = {
      customers: {
        yesterday: yesterdayCustomers,
        today: todayCustomers,
        week: weekCustomers,
      },
      calls: {
        yesterday: yesterdayCalls,
        today: todayCalls,
        week: weekCalls,
      },
    };

    // 3. 월별 추이 (최근 6개월)
    const monthlyTrend = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      // 해당 월의 신규 고객 수
      const customers = await prisma.customer.count({
        where: {
          ...customerFilter,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // 해당 월의 계약 건수 (COMPLETED 상태로 변경된 관심 카드)
      const contracts = await prisma.interestCard.count({
        where: {
          status: 'COMPLETED',
          updatedAt: {
            gte: startDate,
            lte: endDate,
          },
          ...(isEmployee && {
            customer: {
              assignedUserId: session.user.id,
            },
          }),
        },
      });

      monthlyTrend.push({
        month: `${startDate.getMonth() + 1}월`,
        customers,
        contracts,
      });
    }

    // 4. 최근 계약 현황 (계약대장)
    const recentContracts = await prisma.interestCard.findMany({
      where: {
        status: 'COMPLETED',
        ...(isEmployee && {
          customer: {
            assignedUserId: session.user.id,
          },
        }),
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
            assignedSite: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 10,
    });

    const contractList = recentContracts.map((contract) => ({
      id: contract.id,
      customerName: contract.customer.name || '미등록',
      site: contract.customer.assignedSite || '미지정',
      date: contract.updatedAt.toISOString().split('T')[0],
    }));

    return NextResponse.json({
      success: true,
      data: {
        customersBySite: siteData,
        dbUpdateStats,
        monthlyTrend,
        contractList,
      },
    });
  } catch (error) {
    console.error('Failed to fetch detailed statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch detailed statistics' },
      { status: 500 }
    );
  }
}
