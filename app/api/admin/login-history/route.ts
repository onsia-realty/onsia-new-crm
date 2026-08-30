import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/login-history - 직원 로그인 기록 조회 (ADMIN, CEO 전용)
//
// 쿼리 파라미터
//  - userId     : 특정 직원만 조회 (선택)
//  - days       : 조회 기간(일). 기본 30
//  - page/limit : 페이지네이션. 기본 1 / 50
//  - onlyFailed : 'true'면 로그인 실패 기록만
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ADMIN, CEO만 접근 가능
    if (session.user.role !== 'ADMIN' && session.user.role !== 'CEO') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;
    const days = Math.min(Math.max(Number(searchParams.get('days')) || 30, 1), 365);
    const page = Math.max(Number(searchParams.get('page')) || 1, 1);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200);
    const onlyFailed = searchParams.get('onlyFailed') === 'true';

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where = {
      action: onlyFailed ? 'LOGIN_FAILED' : { in: ['LOGIN', 'LOGIN_FAILED'] },
      createdAt: { gte: since },
      ...(userId ? { userId } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { name: true, username: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // 직원 요약 목록
    const users = await prisma.user.findMany({
      where: { role: { not: 'PENDING' } },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
      },
      orderBy: { name: 'asc' },
    });

    // 유저별 마지막 활동 시각을 groupBy 한 번으로 집계 (N+1 방지)
    const lastActivity = await prisma.auditLog.groupBy({
      by: ['userId'],
      _max: { createdAt: true },
    });
    const lastActivityMap = new Map<string, Date | null>(
      lastActivity
        .filter((row) => row.userId !== null)
        .map((row) => [row.userId as string, row._max.createdAt])
    );

    // 주의: 세션이 JWT 기반이라 재로그인 전까지 lastLoginAt이 갱신되지 않음.
    // 따라서 "실제로 시스템을 쓰고 있는지"는 lastLoginAt이 아니라 lastActivityAt(감사로그 최신 시각)으로 판단해야 함.
    const userSummaries = users.map((u) => ({
      ...u,
      lastActivityAt: lastActivityMap.get(u.id) ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        logs,
        total,
        page,
        limit,
        users: userSummaries,
      },
    });
  } catch (error) {
    console.error('Failed to fetch login history:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '로그인 기록 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
