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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { teamId: true },
    });

    if (!user?.teamId) {
      return NextResponse.json({
        success: true,
        data: {
          teamCustomers: 0,
          teamCallsToday: 0,
          teamScheduledVisits: 0,
          teamMonthlyContracts: 0,
          teamMemberCount: 0,
        },
      });
    }

    // 팀원 목록
    const teamMembers = await prisma.user.findMany({
      where: { teamId: user.teamId },
      select: { id: true },
    });

    const teamMemberIds = teamMembers.map(m => m.id);

    // 팀 전체 고객 수
    const teamCustomers = await prisma.customer.count({
      where: {
        assignedUserId: {
          in: teamMemberIds,
        },
      },
    });

    // 오늘 팀 전체 통화 기록
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const teamCallsToday = await prisma.callLog.count({
      where: {
        userId: {
          in: teamMemberIds,
        },
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // 팀 전체 예정 방문 일정
    const teamScheduledVisits = await prisma.visitSchedule.count({
      where: {
        userId: {
          in: teamMemberIds,
        },
        visitDate: {
          gte: new Date(),
        },
        status: 'SCHEDULED',
      },
    });

    // 이번 달 팀 전체 계약 (임시로 0 - 추후 InterestCard 스키마 확인 후 구현)
    const teamMonthlyContracts = 0;

    return NextResponse.json({
      success: true,
      data: {
        teamCustomers,
        teamCallsToday,
        teamScheduledVisits,
        teamMonthlyContracts,
        teamMemberCount: teamMembers.length,
      },
    });
  } catch (error) {
    console.error('Error fetching team leader statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
