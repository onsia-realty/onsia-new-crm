import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getCurrentWeekKey,
  isValidWeekKey,
  getWeekLabel,
} from '@/lib/ad-calls/week-key';

// GET /api/ad-calls/awards/weekly?week=YYYY-Www
// 공개 시상 보드 — 모든 직원이 볼 수 있는 주간 광고콜 지급 랭킹
// 응답: 등수, 직원명, 지급 콜 수, 전환율(있을 때만), isMe 플래그
// feedback / 현장 상세는 미포함 (프라이버시 보호)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const weekParam = req.nextUrl.searchParams.get('week');
    const weekKey =
      weekParam && isValidWeekKey(weekParam) ? weekParam : getCurrentWeekKey();

    // 1. 해당 주간의 시상 집계 (직원별 콜 수 합산)
    const awards = await prisma.adCallAward.groupBy({
      by: ['userId'],
      where: { weekKey },
      _sum: { count: true },
    });

    if (awards.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          weekKey,
          weekLabel: getWeekLabel(weekKey),
          rankings: [],
          totalAwarded: 0,
        },
      });
    }

    const userIds = awards.map((a) => a.userId);

    // 2. 직원 정보 조회
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, department: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // 3. 전환율 계산 (PENDING 풀에서 지급된 콜에 한정)
    //    AdCallNumber.awardId가 있고, 해당 award가 이번 주이고, status='CONVERTED'
    const awardIdsByUser = await prisma.adCallAward.findMany({
      where: { weekKey, userId: { in: userIds } },
      select: { id: true, userId: true },
    });
    const userToAwardIds = new Map<string, string[]>();
    for (const a of awardIdsByUser) {
      if (!userToAwardIds.has(a.userId)) userToAwardIds.set(a.userId, []);
      userToAwardIds.get(a.userId)!.push(a.id);
    }
    const allAwardIds = awardIdsByUser.map((a) => a.id);

    const linkedCalls =
      allAwardIds.length > 0
        ? await prisma.adCallNumber.findMany({
            where: { awardId: { in: allAwardIds } },
            select: { awardId: true, status: true },
          })
        : [];

    // award별 → user별로 환산
    const awardToUser = new Map(awardIdsByUser.map((a) => [a.id, a.userId]));
    const linkedTotalByUser = new Map<string, number>();
    const linkedConvertedByUser = new Map<string, number>();
    for (const c of linkedCalls) {
      const uid = awardToUser.get(c.awardId!);
      if (!uid) continue;
      linkedTotalByUser.set(uid, (linkedTotalByUser.get(uid) || 0) + 1);
      if (c.status === 'CONVERTED') {
        linkedConvertedByUser.set(uid, (linkedConvertedByUser.get(uid) || 0) + 1);
      }
    }

    // 4. 정렬 + 랭킹 부여 (동점 처리: 같은 콜 수 같은 등수)
    const rows = awards
      .map((a) => {
        const u = userMap.get(a.userId);
        const totalCount = a._sum.count ?? 0;
        const linkedTotal = linkedTotalByUser.get(a.userId) ?? 0;
        const linkedConverted = linkedConvertedByUser.get(a.userId) ?? 0;
        return {
          userId: a.userId,
          userName: u?.name ?? '(알 수 없음)',
          department: u?.department ?? null,
          totalCount,
          conversionRate:
            linkedTotal > 0 ? Math.round((linkedConverted / linkedTotal) * 100) : null,
          isMe: a.userId === session.user.id,
        };
      })
      .sort((a, b) => b.totalCount - a.totalCount);

    let currentRank = 0;
    let prevCount = Number.POSITIVE_INFINITY;
    const rankings = rows.map((row, idx) => {
      if (row.totalCount < prevCount) {
        currentRank = idx + 1;
        prevCount = row.totalCount;
      }
      return { rank: currentRank, ...row };
    });

    const totalAwarded = rankings.reduce((sum, r) => sum + r.totalCount, 0);

    return NextResponse.json(
      {
        success: true,
        data: {
          weekKey,
          weekLabel: getWeekLabel(weekKey),
          rankings,
          totalAwarded,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch weekly awards:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weekly awards' },
      { status: 500 }
    );
  }
}
