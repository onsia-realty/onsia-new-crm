import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getKoreaTodayStart, getKoreaTodayEnd } from '@/lib/date-utils';

// GET /api/admin/employees/[id]/summary - 관리자가 특정 직원 화면 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['ADMIN', 'CEO', 'HEAD', 'TEAM_LEADER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        position: true,
        teamId: true,
        isActive: true,
        joinedAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: '직원을 찾을 수 없습니다.' }, { status: 404 });
    }

    const todayStart = getKoreaTodayStart();
    const todayEnd = getKoreaTodayEnd();

    const [
      myCustomers,
      todayCallLogs,
      todayMissedCalls,
      publicClaimsAll,
      recentCalls,
      recentCustomers,
      recentReports,
    ] = await Promise.all([
      // 현재 담당 고객 수
      prisma.customer.count({
        where: { assignedUserId: id, isDeleted: false },
      }),
      // 오늘 통화 수
      prisma.callLog.count({
        where: { userId: id, createdAt: { gte: todayStart, lt: todayEnd } },
      }),
      // 오늘 부재 콜 수
      prisma.callLog.count({
        where: {
          userId: id,
          content: { contains: '부재' },
          createdAt: { gte: todayStart, lt: todayEnd },
        },
      }),
      // 누적 공개DB 클레임 (DISTINCT 고객)
      prisma.customerAllocation.findMany({
        where: { toUserId: id, reason: { startsWith: '공개DB에서 클레임' } },
        select: { customerId: true },
      }),
      // 최근 통화 기록 10건
      prisma.callLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          content: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      }),
      // 최근 담당 고객 10명
      prisma.customer.findMany({
        where: { assignedUserId: id, isDeleted: false },
        orderBy: [{ assignedAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        select: {
          id: true,
          name: true,
          phone: true,
          createdAt: true,
          assignedAt: true,
          assignedSite: true,
          isPublic: true,
        },
      }),
      // 최근 업무보고 5개
      prisma.dailyReport.findMany({
        where: { userId: id },
        orderBy: { date: 'desc' },
        take: 5,
        select: {
          id: true,
          date: true,
          clockIn: true,
          clockOut: true,
          customersCreated: true,
          allocationsReceived: true,
          callLogsCreated: true,
          missedCallsCount: true,
          memosCreated: true,
          contractsCount: true,
          subscriptionsCount: true,
          note: true,
        },
      }),
    ]);

    const publicClaimsAllTime = new Set(publicClaimsAll.map((c) => c.customerId)).size;

    return NextResponse.json({
      success: true,
      data: {
        user,
        stats: {
          myCustomers,
          todayCallLogs,
          todayMissedCalls,
          publicClaimsAllTime,
        },
        recentCalls,
        recentCustomers,
        recentReports,
      },
    });
  } catch (error) {
    console.error('Failed to fetch employee summary:', error);
    return NextResponse.json(
      { success: false, error: '직원 정보를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
