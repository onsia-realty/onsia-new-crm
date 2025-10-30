import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// GET /api/activities/team-visits - 팀 방문 일정 피드 조회
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 최근 7일 이내 등록된 일정 OR 오늘 이후 방문 예정인 일정
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 역할별 조회 범위 설정
    let whereClause: Prisma.VisitScheduleWhereInput = {
      OR: [
        {
          // 최근 7일 이내 등록된 일정
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        {
          // 오늘 이후 방문 예정인 일정
          visitDate: {
            gte: today,
          },
        },
      ],
    };

    // 직원: 같은 팀의 방문 일정만
    if (session.user.role === 'EMPLOYEE') {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { teamId: true },
      });

      if (currentUser?.teamId) {
        whereClause = {
          ...whereClause,
          user: {
            teamId: currentUser.teamId,
          },
        };
      } else {
        // 팀이 없는 경우 자신의 일정만
        whereClause = {
          ...whereClause,
          userId: session.user.id,
        };
      }
    }

    // 팀장: 자신의 팀 방문 일정만
    if (session.user.role === 'TEAM_LEADER') {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { teamId: true },
      });

      if (currentUser?.teamId) {
        whereClause = {
          ...whereClause,
          user: {
            teamId: currentUser.teamId,
          },
        };
      }
    }

    // 본부장/CEO/ADMIN: 모든 방문 일정 (whereClause 그대로 사용)

    // 방문 일정 조회
    const visitSchedules = await prisma.visitSchedule.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            assignedUserId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            department: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10, // 최근 10건
    });

    // 데이터 포맷팅
    const formattedActivities = visitSchedules.map((schedule) => ({
      id: schedule.id,
      userName: schedule.user?.name || '알 수 없음',
      customerName: schedule.customer?.name || '미등록',
      customerId: schedule.customer.id,
      visitDate: schedule.visitDate,
      createdAt: schedule.createdAt,
      assignedUserId: schedule.customer.assignedUserId,
      visitType: schedule.visitType,
    }));

    return NextResponse.json({
      success: true,
      data: formattedActivities,
    });
  } catch (error) {
    console.error('Failed to fetch team visit activities:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team visit activities' },
      { status: 500 }
    );
  }
}
