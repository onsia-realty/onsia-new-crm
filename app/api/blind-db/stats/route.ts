import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getKoreaTodayStart, getKoreaTodayEnd } from '@/lib/date-utils'
import { getBlindDbState } from '@/lib/blind-db/config'
import { excludeOwnBlindEntries } from '@/lib/blind-db/mask'
import { BLIND_DB_TARGET_PER_USER, BLIND_CLAIM_REASON } from '@/lib/constants/blind-db'
import { TEST_ACCOUNT_USER_IDS } from '@/lib/constants/test-accounts'

// GET /api/blind-db/stats
//  - 기본: 오픈 상태 + 잔여/풀 크기 + 오늘 통화 수 + 내 진행률 (전 직원)
//  - ?byUser=1 : 직원별 등록/유출 현황 (전 직원 열람 — 건수만 내려가고 고객 정보는 없다.
//                리더보드와 동일한 공개 기준)
// "오늘"은 한국 시간 자정 ~ 다음 자정 기준.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const byUser = searchParams.get('byUser') === '1'
    if (byUser && session.user.role === 'PENDING') {
      return NextResponse.json(
        { success: false, error: '승인 후 조회할 수 있습니다.' },
        { status: 403 }
      )
    }

    const state = await getBlindDbState()
    const startUtc = getKoreaTodayStart()
    const endUtc = getKoreaTodayEnd()

    const [remaining, poolTotal, todayCallRows, myContributed, contribGroups] = await Promise.all([
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
      // 오늘 블라인드DB 통화 — 전 직원 합산.
      // isBlind만 보면 "풀에 넘기기 전 이전 담당자가 오늘 걸었던 통화"까지 세어져
      // 아무도 안 돌렸는데 수십 건으로 뜬다. blindAt 이후 로그만 인정한다
      // (filterBlindCallLogs와 동일 규칙, 경계 >=).
      // 클레임 시 blindAt은 유지되므로 가져간 뒤의 통화도 계속 집계된다.
      // Prisma는 컬럼 간 비교를 못 하므로 후보 행만 가져와 JS에서 판정한다.
      prisma.callLog.findMany({
        where: {
          createdAt: { gte: startUtc, lt: endUtc },
          customer: { blindAt: { not: null } },
        },
        select: { createdAt: true, customer: { select: { blindAt: true } } },
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

    const todayCalls = todayCallRows.filter(
      (l) => l.customer.blindAt && l.createdAt >= l.customer.blindAt
    ).length

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

      // 대상 직원 목록은 고정한다 — "누가 안 넣었는지"가 이 집계의 목적이므로
      // 실제 등록자가 아니라 활성 직원 전체를 기준으로 뽑고 0건도 포함시킨다.
      // 리더보드와 동일 기준(EMPLOYEE + isActive, 테스트 계정 제외)
      const users = await prisma.user.findMany({
        where: {
          role: 'EMPLOYEE',
          isActive: true,
          id: { notIn: TEST_ACCOUNT_USER_IDS },
        },
        select: { id: true, name: true, username: true },
      })

      const contributors = users
        .map((u) => ({
          userId: u.id,
          name: u.name,
          username: u.username,
          contributed: contributedById.get(u.id) ?? 0,
          claimedAway: claimedAwayById.get(u.id) ?? 0,
        }))
        // 등록수 내림차순, 동수면 이름 오름차순
        .sort((a, b) => b.contributed - a.contributed || a.name.localeCompare(b.name))

      data.contributors = contributors
      data.contributedTotal = contributors.reduce((sum, c) => sum + c.contributed, 0)
      data.targetTotal = contributors.length * BLIND_DB_TARGET_PER_USER
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
