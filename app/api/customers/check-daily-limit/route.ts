/**
 * 일일 고객 등록 제한 확인 API
 * GET /api/customers/check-daily-limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const DAILY_LIMIT = 50; // 일일 최대 등록 건수

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자는 제한 없음
    if (session.user.role === 'ADMIN') {
      return NextResponse.json({
        canRegister: true,
        isAdmin: true,
        todayCount: 0,
        limit: DAILY_LIMIT,
        remaining: DAILY_LIMIT,
        isApproved: false,
      });
    }

    // 오늘 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 오늘 승인 받은 횟수 확인
    const approvalCount = await prisma.dailyLimitApproval.count({
      where: {
        userId: session.user.id,
        date: today,
      },
    });

    // 현재 제한: 기본 50 + (승인 횟수 × 50)
    const currentLimit = DAILY_LIMIT + (approvalCount * DAILY_LIMIT);

    // 오늘 등록한 고객 수
    const todayCount = await prisma.customer.count({
      where: {
        assignedUserId: session.user.id,
        createdAt: {
          gte: today,
        },
      },
    });

    const canRegister = todayCount < currentLimit;
    const remaining = Math.max(0, currentLimit - todayCount);

    return NextResponse.json({
      canRegister,
      isAdmin: false,
      todayCount,
      baseLimit: DAILY_LIMIT,
      approvalCount,
      currentLimit,
      remaining,
      needsApproval: !canRegister,
    });
  } catch (error: unknown) {
    console.error('일일 제한 확인 오류:', error);
    return NextResponse.json(
      { error: '일일 제한 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
