import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 현재 로그인된 사용자 목록 조회
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 최근 5분 이내 활동이 있는 사용자를 "온라인"으로 간주
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // 최근 5분 이내 AuditLog에 기록된 사용자들
    const recentLogs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: fiveMinutesAgo,
        },
        userId: {
          not: null,
        },
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    });

    const onlineUserIds = recentLogs
      .map((log) => log.userId)
      .filter((id): id is string => id !== null);

    // 온라인 사용자 정보 조회
    const onlineUsers = await prisma.user.findMany({
      where: {
        id: { in: onlineUserIds },
        approvedAt: { not: null },
      },
      select: {
        id: true,
        name: true,
        role: true,
        department: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: onlineUsers,
      count: onlineUsers.length,
    });
  } catch (error) {
    console.error('Error fetching online users:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
