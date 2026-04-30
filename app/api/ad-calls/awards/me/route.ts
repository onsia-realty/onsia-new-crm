import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getCurrentWeekKey,
  isValidWeekKey,
  getWeekLabel,
} from '@/lib/ad-calls/week-key';

// GET /api/ad-calls/awards/me?week=YYYY-Www
// 본인 광고콜 시상 상세 — 본인만 호출 가능
// 응답: 총 지급, 현장별 분포, 상태 카운트(전환/부재/무효/대기), 관리자 피드백 목록
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const weekParam = req.nextUrl.searchParams.get('week');
    const weekKey =
      weekParam && isValidWeekKey(weekParam) ? weekParam : getCurrentWeekKey();

    // 1. 본인이 받은 시상 + 연결된 광고콜 + 배분한 관리자 정보
    const awards = await prisma.adCallAward.findMany({
      where: { userId, weekKey },
      orderBy: { createdAt: 'desc' },
      include: {
        awardedBy: { select: { id: true, name: true } },
        adCalls: {
          select: {
            id: true,
            phone: true,
            siteName: true,
            source: true,
            status: true,
            assignedAt: true,
            convertedToCustomerId: true,
          },
        },
      },
    });

    // 1-1. CONVERTED된 콜의 Customer 정보 일괄 조회 (양식 다시 보기용)
    const convertedCustomerIds = awards
      .flatMap((a) => a.adCalls)
      .map((c) => c.convertedToCustomerId)
      .filter((id): id is string => !!id);

    const customers = convertedCustomerIds.length
      ? await prisma.customer.findMany({
          where: { id: { in: convertedCustomerIds } },
          select: {
            id: true,
            name: true,
            gender: true,
            ageRange: true,
            residenceArea: true,
            memo: true,
            nextVisitDate: true,
            assignedSite: true,
            grade: true,
          },
        })
      : [];
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    // 2. 집계: 총 지급량
    const totalCount = awards.reduce((sum, a) => sum + a.count, 0);

    // 3. 현장별 분포 (AdCallAward.siteName 기반 — 즉석 입력도 포함)
    const sitesMap = new Map<string, { count: number; latestAt: Date }>();
    for (const a of awards) {
      const site = a.siteName ?? '미지정';
      const existing = sitesMap.get(site);
      if (existing) {
        existing.count += a.count;
        if (a.createdAt > existing.latestAt) existing.latestAt = a.createdAt;
      } else {
        sitesMap.set(site, { count: a.count, latestAt: a.createdAt });
      }
    }
    const sites = Array.from(sitesMap.entries())
      .map(([name, info]) => ({
        name,
        count: info.count,
        latestAt: info.latestAt.toISOString(),
      }))
      .sort((a, b) => b.count - a.count);

    // 4. 상태 카운트 (연결된 AdCallNumber 기준)
    const statusCount = {
      pending: 0,
      assigned: 0,
      converted: 0,
      invalid: 0,
    };
    for (const a of awards) {
      for (const call of a.adCalls) {
        switch (call.status) {
          case 'PENDING':
            statusCount.pending++;
            break;
          case 'ASSIGNED':
            statusCount.assigned++;
            break;
          case 'CONVERTED':
            statusCount.converted++;
            break;
          case 'INVALID':
            statusCount.invalid++;
            break;
        }
      }
    }

    // 5. 관리자 피드백 목록 (시상별)
    const feedbacks = awards
      .filter((a) => a.feedback && a.feedback.trim().length > 0)
      .map((a) => ({
        awardId: a.id,
        feedback: a.feedback!,
        siteName: a.siteName,
        count: a.count,
        awardedByName: a.awardedBy.name,
        createdAt: a.createdAt.toISOString(),
      }));

    // 5-1. 받은 콜 리스트 (전환 가능한 PENDING/ASSIGNED만, 시상별로)
    const awardCallList = awards.map((a) => ({
      awardId: a.id,
      siteName: a.siteName,
      count: a.count,
      feedback: a.feedback,
      awardedByName: a.awardedBy.name,
      awardedAt: a.createdAt.toISOString(),
      calls: a.adCalls.map((c) => {
        const cust = c.convertedToCustomerId ? customerMap.get(c.convertedToCustomerId) : null;
        return {
          id: c.id,
          phone: c.phone,
          siteName: c.siteName,
          source: c.source, // 광고매체
          status: c.status,
          convertedToCustomerId: c.convertedToCustomerId,
          assignedAt: c.assignedAt?.toISOString() ?? null,
          // CONVERTED된 경우 Customer 정보 (양식 다시 보기용)
          customer: cust
            ? {
                id: cust.id,
                name: cust.name,
                gender: cust.gender,
                ageRange: cust.ageRange,
                residenceArea: cust.residenceArea,
                memo: cust.memo,
                nextVisitDate: cust.nextVisitDate?.toISOString() ?? null,
                assignedSite: cust.assignedSite,
                grade: cust.grade,
              }
            : null,
        };
      }),
    }));

    // 6. 미확인 시상이 있으면 읽음 처리
    const unreadIds = awards.filter((a) => !a.isReadByUser).map((a) => a.id);
    if (unreadIds.length > 0) {
      await prisma.adCallAward.updateMany({
        where: { id: { in: unreadIds } },
        data: { isReadByUser: true },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        weekKey,
        weekLabel: getWeekLabel(weekKey),
        totalCount,
        sites,
        statusCount,
        feedbacks,
        awardCount: awards.length,
        awards: awardCallList,
      },
    });
  } catch (error) {
    console.error('Failed to fetch my award detail:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch my award detail' },
      { status: 500 }
    );
  }
}
