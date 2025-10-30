import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/statistics/admin - 관리자 대시보드 통계
export async function GET() {
  try {
    const session = await auth();

    // 관리자/본부장 권한 체크
    if (!session || !['ADMIN', 'HEAD'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin or Head role required' },
        { status: 403 }
      );
    }

    // 오늘 날짜 범위
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 이번 달 범위
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const nextMonth = new Date(thisMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // 병렬로 모든 통계 조회
    const [
      // 오늘 통계
      todayNewCustomers,
      todayCallLogs,
      todayVisits,
      todayContracts,

      // 이번달 통계
      monthlyNewCustomers,
      monthlyCallLogs,
      monthlyVisits,
      monthlyContracts,

      // 미승인 가입자
      pendingUsers,

      // 금일 방문 일정
      todaySchedules,

      // 미체크 방문 (오늘 이전 SCHEDULED 상태)
      uncheckedVisits,

      // 고객 배분된 직원 리스트
      assignedEmployees
    ] = await Promise.all([
      // === 오늘 통계 ===
      // 오늘 신규 고객
      prisma.customer.count({
        where: {
          createdAt: { gte: today, lt: tomorrow },
          isDeleted: false
        }
      }),

      // 오늘 통화 기록
      prisma.callLog.count({
        where: {
          createdAt: { gte: today, lt: tomorrow }
        }
      }),

      // 오늘 방문 일정 (모든 상태)
      prisma.visitSchedule.count({
        where: {
          visitDate: { gte: today, lt: tomorrow }
        }
      }),

      // 오늘 계약 (COMPLETED 상태로 변경된 관심 카드)
      prisma.interestCard.count({
        where: {
          status: 'COMPLETED',
          updatedAt: { gte: today, lt: tomorrow }
        }
      }),

      // === 이번달 통계 ===
      // 이번달 신규 고객
      prisma.customer.count({
        where: {
          createdAt: { gte: thisMonth, lt: nextMonth },
          isDeleted: false
        }
      }),

      // 이번달 통화 기록
      prisma.callLog.count({
        where: {
          createdAt: { gte: thisMonth, lt: nextMonth }
        }
      }),

      // 이번달 방문 일정
      prisma.visitSchedule.count({
        where: {
          visitDate: { gte: thisMonth, lt: nextMonth }
        }
      }),

      // 이번달 계약
      prisma.interestCard.count({
        where: {
          status: 'COMPLETED',
          updatedAt: { gte: thisMonth, lt: nextMonth }
        }
      }),

      // === 미승인 가입자 ===
      prisma.user.findMany({
        where: {
          role: 'PENDING',
          isActive: true
        },
        select: {
          id: true,
          name: true,
          username: true,
          phone: true,
          joinedAt: true
        },
        orderBy: { joinedAt: 'asc' }
      }),

      // === 금일 방문 일정 ===
      prisma.visitSchedule.findMany({
        where: {
          visitDate: { gte: today, lt: tomorrow }
        },
        select: {
          id: true,
          visitDate: true,
          status: true,
          memo: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              assignedSite: true
            }
          },
          user: {
            select: {
              id: true,
              name: true,
              department: true
            }
          }
        },
        orderBy: { visitDate: 'asc' },
        take: 50 // 최대 50건
      }),

      // === 미체크 방문 (알림용) ===
      prisma.visitSchedule.count({
        where: {
          visitDate: { lt: today }, // 오늘 이전
          status: 'SCHEDULED' // 아직 체크 안됨
        }
      }),

      // === 고객 배분된 직원 리스트 ===
      prisma.user.findMany({
        where: {
          isActive: true,
          role: { notIn: ['PENDING', 'ADMIN'] },
          customers: {
            some: {
              isDeleted: false
            }
          }
        },
        select: {
          id: true,
          name: true,
          department: true,
          _count: {
            select: {
              customers: {
                where: {
                  isDeleted: false
                }
              }
            }
          }
        },
        orderBy: {
          name: 'asc'
        }
      })
    ]);

    // 직원별 통계 (고객이 배분된 직원만)
    const employeeStats = assignedEmployees.map(emp => ({
      id: emp.id,
      name: emp.name,
      department: emp.department || '미지정',
      customerCount: emp._count.customers
    }));

    return NextResponse.json({
      success: true,
      data: {
        today: {
          newCustomers: todayNewCustomers,
          callLogs: todayCallLogs,
          visits: todayVisits,
          contracts: todayContracts
        },
        monthly: {
          newCustomers: monthlyNewCustomers,
          callLogs: monthlyCallLogs,
          visits: monthlyVisits,
          contracts: monthlyContracts
        },
        alerts: {
          pendingUsersCount: pendingUsers.length,
          uncheckedVisitsCount: uncheckedVisits
        },
        pendingUsers,
        todaySchedules,
        employeeStats
      }
    });
  } catch (error) {
    console.error('Failed to fetch admin statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
