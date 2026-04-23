import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LEADERBOARD_WEIGHTS, calculateTotalScore } from '@/lib/leaderboard/weights';
import { getPeriodRange, parsePeriod } from '@/lib/leaderboard/period';

// GET /api/leaderboard?period=today|week|month
// 전 직원 공개. 랭킹 대상은 EMPLOYEE + isActive만.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const period = parsePeriod(req.nextUrl.searchParams.get('period'));
    const { from, to } = getPeriodRange(period);

    // 1. 대상 직원 목록 (EMPLOYEE + 활성)
    const employees = await prisma.user.findMany({
      where: {
        role: 'EMPLOYEE',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        department: true,
        teamId: true,
      },
      orderBy: { name: 'asc' },
    });
    const userIds = employees.map((u) => u.id);

    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          period,
          rangeFrom: from.toISOString(),
          rangeTo: to.toISOString(),
          weights: LEADERBOARD_WEIGHTS,
          rankings: [],
          myRank: null,
        },
      });
    }

    // 2. 5개 지표 병렬 집계
    const [
      callCounts,
      absenceCallCounts,
      publicClaims,
      newCustomerCounts,
      contractRecords,
    ] = await Promise.all([
      // 통화 수
      prisma.callLog.groupBy({
        by: ['userId'],
        where: {
          userId: { in: userIds },
          createdAt: { gte: from, lt: to },
        },
        _count: { _all: true },
      }),
      // 부재 콜 수
      prisma.callLog.groupBy({
        by: ['userId'],
        where: {
          userId: { in: userIds },
          content: { contains: '부재' },
          createdAt: { gte: from, lt: to },
        },
        _count: { _all: true },
      }),
      // 공개DB 클레임 (DISTINCT customerId per user)
      prisma.customerAllocation.findMany({
        where: {
          toUserId: { in: userIds },
          reason: { startsWith: '공개DB에서 클레임' },
          createdAt: { gte: from, lt: to },
        },
        select: { toUserId: true, customerId: true },
      }),
      // 신규 등록 고객 수 (본인 담당)
      prisma.customer.groupBy({
        by: ['assignedUserId'],
        where: {
          assignedUserId: { in: userIds },
          isDeleted: false,
          createdAt: { gte: from, lt: to },
        },
        _count: { _all: true },
      }),
      // 계약 수 — InterestCard.status=COMPLETED (기간 내 생성 + 해당 고객이 대상 직원 담당)
      prisma.interestCard.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: from, lt: to },
          customer: { assignedUserId: { in: userIds } },
        },
        select: { customer: { select: { assignedUserId: true } } },
      }),
    ]);

    // 3. 맵 구성
    const callMap = new Map<string, number>();
    callCounts.forEach((c) => {
      if (c.userId) callMap.set(c.userId, c._count._all);
    });
    const absenceMap = new Map<string, number>();
    absenceCallCounts.forEach((c) => {
      if (c.userId) absenceMap.set(c.userId, c._count._all);
    });
    const claimMap = new Map<string, Set<string>>();
    publicClaims.forEach((a) => {
      if (!a.toUserId) return;
      if (!claimMap.has(a.toUserId)) claimMap.set(a.toUserId, new Set());
      claimMap.get(a.toUserId)!.add(a.customerId);
    });
    const newCustMap = new Map<string, number>();
    newCustomerCounts.forEach((c) => {
      if (c.assignedUserId) newCustMap.set(c.assignedUserId, c._count._all);
    });
    const contractMap = new Map<string, number>();
    contractRecords.forEach((r) => {
      const uid = r.customer?.assignedUserId;
      if (!uid) return;
      contractMap.set(uid, (contractMap.get(uid) || 0) + 1);
    });

    // 4. 랭킹 계산
    const rows = employees.map((emp) => {
      const callCount = callMap.get(emp.id) || 0;
      const absenceCallCount = absenceMap.get(emp.id) || 0;
      const publicClaimCount = claimMap.get(emp.id)?.size || 0;
      const newCustomerCount = newCustMap.get(emp.id) || 0;
      const contractCount = contractMap.get(emp.id) || 0;
      return {
        userId: emp.id,
        userName: emp.name,
        team: emp.teamId ?? null,
        department: emp.department ?? null,
        callCount,
        absenceCallCount,
        publicClaimCount,
        newCustomerCount,
        contractCount,
        totalScore: calculateTotalScore({
          callCount,
          absenceCallCount,
          publicClaimCount,
          newCustomerCount,
          contractCount,
        }),
      };
    });

    // 종합 점수 내림차순 정렬 + rank 부여 (동점 처리: 같은 점수 같은 등수)
    rows.sort((a, b) => b.totalScore - a.totalScore);
    let currentRank = 0;
    let prevScore = Number.POSITIVE_INFINITY;
    const rankings = rows.map((row, idx) => {
      if (row.totalScore < prevScore) {
        currentRank = idx + 1;
        prevScore = row.totalScore;
      }
      return { rank: currentRank, ...row };
    });

    // 5. 본인 순위 (EMPLOYEE일 때만)
    const myRank =
      session.user.role === 'EMPLOYEE'
        ? rankings.find((r) => r.userId === session.user.id) ?? null
        : null;

    return NextResponse.json(
      {
        success: true,
        data: {
          period,
          rangeFrom: from.toISOString(),
          rangeTo: to.toISOString(),
          weights: LEADERBOARD_WEIGHTS,
          rankings,
          myRank,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30',
        },
      }
    );
  } catch (error) {
    console.error('Failed to compute leaderboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to compute leaderboard' },
      { status: 500 }
    );
  }
}
