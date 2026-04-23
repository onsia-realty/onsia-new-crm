import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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
    const isPublicParam = searchParams.get('isPublic'); // 'true'면 공개DB 기준 통계

    // 통계를 조회할 사용자 ID 결정
    // 1. userId 파라미터가 있으면 해당 직원의 통계
    // 2. 없으면 EMPLOYEE는 자기 통계, 나머지는 전체 통계
    // ※ 공개DB 모드에서는 담당자 필터 무시 (공개DB는 담당자가 없음)
    const isPublicMode = isPublicParam === 'true';
    const filterUserId = isPublicMode
      ? null
      : targetUserId || (session.user.role === 'EMPLOYEE' ? session.user.id : null);

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
      // 전체 고객 수 (공개DB 모드 or 특정 직원 or 전체)
      prisma.customer.count({
        where: {
          isDeleted: false,
          ...(isPublicMode && { isPublic: true }),
          ...(filterUserId && { assignedUserId: filterUserId }),
        }
      }),

      // 마지막 통화가 부재인 고객 수 (Raw SQL)
      (async () => {
        const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count
          FROM "Customer" c
          INNER JOIN (
            SELECT "customerId", MAX("createdAt") as "lastCallAt"
            FROM "CallLog"
            GROUP BY "customerId"
          ) latest ON c.id = latest."customerId"
          INNER JOIN "CallLog" cl ON cl."customerId" = c.id AND cl."createdAt" = latest."lastCallAt"
          WHERE c."isDeleted" = false
          AND cl.content LIKE '%부재%'
          ${isPublicMode ? Prisma.sql`AND c."isPublic" = true` : Prisma.empty}
          ${filterUserId ? Prisma.sql`AND c."assignedUserId" = ${filterUserId}` : Prisma.empty}
        `;
        return Number(result[0]?.count || 0);
      })(),

      // 오늘 통화 기록 수 (공개DB 모드에서는 담당자가 없어서 0이므로 스킵)
      isPublicMode ? Promise.resolve(0) : prisma.callLog.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow
          },
          ...(filterUserId && { userId: filterUserId })
        }
      }),

      // 예정된 방문 일정 수 (공개DB 모드에서는 담당자가 없어서 의미 없음)
      isPublicMode ? Promise.resolve(0) : prisma.visitSchedule.count({
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
            ...(isPublicMode && { isPublic: true }),
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
            ...(isPublicMode && { isPublic: true }),
            phone: {
              in: duplicatePhones.map(d => d.phone)
            },
            ...(filterUserId && { assignedUserId: filterUserId })
          }
        });

        return count;
      })()
    ]);

    // 공개DB 모드 전용 통계: 클레임 관련 (전체 기준)
    let publicClaimCount = 0;
    let publicClaimUserCount = 0;
    if (isPublicMode) {
      const claimed = await prisma.customerAllocation.findMany({
        where: {
          reason: { startsWith: '공개DB에서 클레임' },
          toUserId: { not: null },
        },
        select: { customerId: true, toUserId: true },
      });
      const uniqueCustomers = new Set(claimed.map((c) => c.customerId));
      const uniqueUsers = new Set(claimed.map((c) => c.toUserId).filter(Boolean));
      publicClaimCount = uniqueCustomers.size;
      publicClaimUserCount = uniqueUsers.size;
    }

    // 일반 모드: 내가(또는 특정 직원이) 공개DB에서 가져온 고객 수 (DISTINCT)
    let claimedFromPublicCount = 0;
    if (!isPublicMode) {
      const claimed = await prisma.customerAllocation.findMany({
        where: {
          reason: { startsWith: '공개DB에서 클레임' },
          ...(filterUserId ? { toUserId: filterUserId } : { toUserId: { not: null } }),
        },
        select: { customerId: true },
      });
      claimedFromPublicCount = new Set(claimed.map((c) => c.customerId)).size;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalCustomers,
        absenceCustomers,
        todayCallLogs,
        scheduledVisits,
        duplicateCustomers,
        claimedFromPublicCount,
        ...(isPublicMode && { publicClaimCount, publicClaimUserCount }),
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