/**
 * 관리자 일일 제한 승인 API
 * POST /api/admin/approve-daily-limit
 * GET /api/admin/approve-daily-limit - 제한 초과 직원 목록
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit';

const DAILY_LIMIT = 50;

// GET - 제한 초과 직원 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 오늘 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 모든 직원의 오늘 등록 건수 조회
    const allUsers = await prisma.user.findMany({
      where: {
        role: {
          not: 'ADMIN',
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
      },
    });

    // 각 직원의 오늘 등록 건수와 승인 상태 확인
    const usersWithCounts = await Promise.all(
      allUsers.map(async (user) => {
        const todayCount = await prisma.customer.count({
          where: {
            assignedUserId: user.id,
            createdAt: {
              gte: today,
            },
          },
        });

        const approvalCount = await prisma.dailyLimitApproval.count({
          where: {
            userId: user.id,
            date: today,
          },
        });

        // 현재 제한: 기본 50 + (승인 횟수 × 50)
        const currentLimit = DAILY_LIMIT + (approvalCount * DAILY_LIMIT);

        return {
          ...user,
          todayCount,
          baseLimit: DAILY_LIMIT,
          approvalCount,
          currentLimit,
          exceeded: todayCount >= currentLimit,
        };
      })
    );

    // 현재 제한 도달한 직원만 필터링
    const exceededUsers = usersWithCounts.filter((u) => u.exceeded);

    return NextResponse.json({
      success: true,
      data: exceededUsers,
      count: exceededUsers.length,
      allUsers: usersWithCounts, // 전체 목록도 함께 반환
    });
  } catch (error: unknown) {
    console.error('제한 초과 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '제한 초과 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST - 직원 일일 제한 승인
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 오늘 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 직원 정보 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 현재 승인 횟수 확인
    const currentApprovalCount = await prisma.dailyLimitApproval.count({
      where: {
        userId,
        date: today,
      },
    });

    // 새 승인 기록 생성 (+50건 추가)
    const approval = await prisma.dailyLimitApproval.create({
      data: {
        userId,
        date: today,
        approvedBy: session.user.id,
      },
    });

    const newApprovalCount = currentApprovalCount + 1;
    const newLimit = DAILY_LIMIT + (newApprovalCount * DAILY_LIMIT);

    // 감사 로그
    await createAuditLog({
      userId: session.user.id,
      action: 'APPROVE_DAILY_LIMIT',
      entity: 'User',
      entityId: userId,
      changes: {
        date: today,
        approvedBy: session.user.id,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({
      success: true,
      message: `${user.name}님의 일일 등록 제한이 +50건 증가했습니다. (현재 제한: ${newLimit}건)`,
      data: {
        approval,
        user,
        approvalCount: newApprovalCount,
        newLimit,
      },
    });
  } catch (error: unknown) {
    console.error('일일 제한 승인 오류:', error);
    return NextResponse.json(
      { error: '승인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
