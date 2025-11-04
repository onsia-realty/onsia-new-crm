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

    const userId = session.user.id;

    // 나에게 배분된 고객 수
    const myCustomers = await prisma.customer.count({
      where: {
        assignedUserId: userId,
      },
    });

    // 오늘 내가 작성한 통화 기록
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const myCallsToday = await prisma.callLog.count({
      where: {
        userId: userId,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // 내 예정 방문 일정 (오늘 이후 SCHEDULED 상태만)
    const now = new Date();
    now.setHours(0, 0, 0, 0); // 오늘 00:00:00부터

    const myScheduledVisits = await prisma.visitSchedule.count({
      where: {
        userId: userId,
        visitDate: {
          gte: now,
        },
        status: 'SCHEDULED',
      },
    });

    // 이번 달 내 계약 (임시로 0 - 추후 InterestCard 스키마 확인 후 구현)
    const myMonthlyContracts = 0;

    // 오늘 등록한 신규 고객 수
    const myNewCustomersToday = await prisma.customer.count({
      where: {
        assignedUserId: userId,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // 오늘 등록한 관심카드 수 (내가 담당하는 고객의 관심카드)
    const myInterestCardsToday = await prisma.interestCard.count({
      where: {
        customer: {
          assignedUserId: userId,
        },
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // 오늘 방문 예정인 일정 (금일만)
    const todayVisits = await prisma.visitSchedule.count({
      where: {
        userId: userId,
        visitDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // 오늘 OCR로 등록한 고객 수 (source가 'OCR'인 고객)
    const ocrCustomersToday = await prisma.customer.count({
      where: {
        assignedUserId: userId,
        source: 'OCR',
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        myCustomers,
        myCallsToday,
        myScheduledVisits,
        myMonthlyContracts,
        myNewCustomersToday,
        myInterestCardsToday,
        todayVisits,
        ocrCustomersToday,
      },
    });
  } catch (error) {
    console.error('Error fetching employee statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
