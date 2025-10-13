import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/statistics - 통계 정보 조회
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 오늘 날짜 범위 설정
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 이번 달 범위 설정
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const nextMonth = new Date(thisMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // 통계 데이터 조회
    const [
      totalCustomers,
      todayCallLogs,
      scheduledVisits,
      monthlyContracts
    ] = await Promise.all([
      // 전체 고객 수
      prisma.customer.count({
        where: session.user.role === 'EMPLOYEE'
          ? { assignedUserId: session.user.id }
          : {}
      }),

      // 오늘 통화 기록 수
      prisma.callLog.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow
          },
          ...(session.user.role === 'EMPLOYEE' && { userId: session.user.id })
        }
      }),

      // 예정된 방문 일정 수
      prisma.visitSchedule.count({
        where: {
          visitDate: {
            gte: new Date() // 현재 시점 이후
          },
          status: 'SCHEDULED',
          ...(session.user.role === 'EMPLOYEE' && { userId: session.user.id })
        }
      }),

      // 이번 달 완료된 계약 (COMPLETED 상태의 관심 카드)
      prisma.interestCard.count({
        where: {
          status: 'COMPLETED',
          updatedAt: {
            gte: thisMonth,
            lt: nextMonth
          },
          ...(session.user.role === 'EMPLOYEE' && {
            customer: {
              assignedUserId: session.user.id
            }
          })
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalCustomers,
        todayCallLogs,
        scheduledVisits,
        monthlyContracts
      }
    });
  } catch (error) {
    console.error('Failed to fetch statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}