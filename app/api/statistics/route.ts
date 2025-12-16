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

    // URL 파라미터에서 userId 가져오기 (특정 직원의 통계 조회용)
    const searchParams = req.nextUrl.searchParams;
    const targetUserId = searchParams.get('userId');

    // 통계를 조회할 사용자 ID 결정
    // 1. userId 파라미터가 있으면 해당 직원의 통계
    // 2. 없으면 EMPLOYEE는 자기 통계, 나머지는 전체 통계
    const filterUserId = targetUserId || (session.user.role === 'EMPLOYEE' ? session.user.id : null);

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
      absenceCustomers,
      todayCallLogs,
      scheduledVisits,
      duplicateCustomers
    ] = await Promise.all([
      // 전체 고객 수 (특정 직원 또는 전체)
      prisma.customer.count({
        where: filterUserId
          ? { assignedUserId: filterUserId, isDeleted: false }
          : { isDeleted: false }
      }),

      // 부재 기록이 있는 고객 수
      prisma.customer.count({
        where: {
          isDeleted: false,
          ...(filterUserId && { assignedUserId: filterUserId }),
          callLogs: {
            some: {
              content: { contains: '부재' }
            }
          }
        }
      }),

      // 오늘 통화 기록 수
      prisma.callLog.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow
          },
          ...(filterUserId && { userId: filterUserId })
        }
      }),

      // 예정된 방문 일정 수
      prisma.visitSchedule.count({
        where: {
          visitDate: {
            gte: new Date() // 현재 시점 이후
          },
          status: 'SCHEDULED',
          ...(filterUserId && { userId: filterUserId })
        }
      }),

      // 중복 고객 수 (같은 전화번호가 2명 이상인 고객 수)
      (async () => {
        const duplicatePhones = await prisma.customer.groupBy({
          by: ['phone'],
          where: {
            isDeleted: false,
            ...(filterUserId && { assignedUserId: filterUserId })
          },
          having: {
            phone: {
              _count: {
                gt: 1
              }
            }
          }
        });

        if (duplicatePhones.length === 0) return 0;

        // 중복된 전화번호를 가진 고객 수 카운트
        const count = await prisma.customer.count({
          where: {
            isDeleted: false,
            phone: {
              in: duplicatePhones.map(d => d.phone)
            },
            ...(filterUserId && { assignedUserId: filterUserId })
          }
        });

        return count;
      })()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalCustomers,
        absenceCustomers,
        todayCallLogs,
        scheduledVisits,
        duplicateCustomers
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