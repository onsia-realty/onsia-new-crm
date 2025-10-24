import { NextRequest, NextResponse } from 'next/server';
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

    // 1. 고객 출처별 분포
    const customersBySource = await prisma.customer.groupBy({
      by: ['source'],
      where: {
        ...customerFilter,
        source: { not: null },
      },
      _count: {
        id: true,
      },
    });

    const sourceLabels: Record<string, string> = {
      AD: '광고',
      TM: 'TM',
      FIELD: '필드',
      REFERRAL: '소개',
    };

    const sourceData = customersBySource.map((item) => ({
      name: sourceLabels[item.source || ''] || item.source || '기타',
      value: item._count.id,
    }));

    // 2. 고객 등급별 분포
    const customersByGrade = await prisma.customer.groupBy({
      by: ['grade'],
      where: customerFilter,
      _count: {
        id: true,
      },
    });

    const gradeLabels: Record<string, string> = {
      A: 'A등급',
      B: 'B등급',
      C: 'C등급',
    };

    const gradeData = customersByGrade.map((item) => ({
      name: gradeLabels[item.grade] || item.grade,
      value: item._count.id,
    }));

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

    return NextResponse.json({
      success: true,
      data: {
        customersBySource: sourceData,
        customersByGrade: gradeData,
        monthlyTrend,
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
