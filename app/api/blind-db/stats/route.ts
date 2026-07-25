import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getKoreaTodayStart, getKoreaTodayEnd } from '@/lib/date-utils'
import { getBlindDbState } from '@/lib/blind-db/config'
import { excludeOwnBlindEntries } from '@/lib/blind-db/mask'
import { BLIND_DB_TARGET_PER_USER, BLIND_CLAIM_REASON } from '@/lib/constants/blind-db'

// GET /api/blind-db/stats
//  - 기본: 오픈 상태 + 잔여/풀 크기 + 오늘 통화 수 + 내 진행률 (전 직원)
//  - ?byUser=1 : 직원별 등록/유출 현황 (ADMIN/CEO 전용)
// "오늘"은 한국 시간 자정 ~ 다음 자정 기준.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const byUser = searchParams.get('byUser') === '1'
    if (byUser && !['ADMIN', 'CEO'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: '관리자만 조회할 수 있습니다.' },
        { status: 403 }
      )
    }

    const state = await getBlindDbState()
    const startUtc = getKoreaTodayStart()
    const endUtc = getKoreaTodayEnd()

    const [remaining, poolTotal, todayCalls, myContributed, contribGroups] = await Promise.all([
      // 내가 가져갈 수 있는 잔여 — 내가 올린 건은 제외
      // excludeOwnBlindEntries는 OR을 반환하므로 AND 배열에 넣는다
      prisma.customer.count({
        where: {
          isBlind: true,
          isDeleted: false,
          AND: [excludeOwnBlindEntries(session.user.id)],
        },
      }),
      // 전체 풀 크기 (원 소유자 제외 없음)
      prisma.customer.count({
        where: { isBlind: true, isDeleted: false },
      }),
      // 오늘 블라인드DB 고객에 대한 통화 수 — 전 직원 합산.
      // isBlind로 집계한다 (blindAt은 회수 시 지워지므로 기준으로 쓸 수 없다)
      prisma.callLog.count({
        where: {
          createdAt: { gte: startUtc, lt: endUtc },
          customer: { isBlind: true },
        },
      }),
      // 내 누적 등록 수
      prisma.customer.count({
        where: { isBlind: true, blindById: session.user.id, isDeleted: false },
      }),
      // 직원별 현재 풀 체류 수 (contributorCount + byUser 공용)
      prisma.customer.groupBy({
        by: ['blindById'],
        where: { isBlind: true, isDeleted: false, blindById: { not: null } },
        _count: { _all: true },
      }),
    ])

    const percent = Math.min(
      100,
      Math.round((myContributed / BLIND_DB_TARGET_PER_USER) * 100)
    )

    const data: Record<string, unknown> = {
      open: state.open,
      openedAt: state.openedAt,
      remaining,
      poolTotal,
      todayCalls,
      myContributed,
      target: BLIND_DB_TARGET_PER_USER,
      percent,
      contributorCount: contribGroups.length,
    }

    if (byUser) {
      // 남이 가져간 수 = 내가 올린 고객의 클레임 배분 이력
      const claimGroups = await prisma.customerAllocation.groupBy({
        by: ['fromUserId'],
        where: { reason: { startsWith: BLIND_CLAIM_REASON }, fromUserId: { not: null } },
        _count: { _all: true },
      })

      const contributedById = new Map(
        contribGroups.map((g) => [g.blindById as string, g._count._all])
      )
      const claimedAwayById = new Map(
        claimGroups.map((g) => [g.fromUserId as string, g._count._all])
      )

      // 풀에 남은 게 없어도 과거에 올린 직원은 포함되어야 하므로 두 집합을 합친다
      const userIds = Array.from(
        new Set([...contributedById.keys(), ...claimedAwayById.keys()])
      )
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, username: true },
      })

      data.contributors = users
        .map((u) => ({
          userId: u.id,
          name: u.name,
          username: u.username,
          contributed: contributedById.get(u.id) ?? 0,
          claimedAway: claimedAwayById.get(u.id) ?? 0,
        }))
        .sort((a, b) => b.contributed - a.contributed)
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Failed to load blind-db stats:', error)
    return NextResponse.json(
      { success: false, error: '블라인드DB 통계를 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}
