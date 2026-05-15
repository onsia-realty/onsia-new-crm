import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getKoreaTodayStart, getKoreaTodayEnd } from '@/lib/date-utils'

// GET /api/public-db/stats
// 잔여 공개DB 수량 + 오늘 공개DB 통화 수 (전 직원 합산)
// "오늘"은 한국 시간 자정 ~ 다음 자정 기준.
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startUtc = getKoreaTodayStart()
    const endUtc = getKoreaTodayEnd()

    const [remaining, todayCalls] = await Promise.all([
      // 현재 공개DB에 남아있는(미클레임) 고객 수
      prisma.customer.count({
        where: { isPublic: true, isDeleted: false },
      }),
      // 오늘 공개DB 출처 고객(publicAt이 있는 고객)에 대한 통화 수 — 전 직원 합산
      prisma.callLog.count({
        where: {
          createdAt: { gte: startUtc, lt: endUtc },
          customer: { publicAt: { not: null } },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: { remaining, todayCalls },
    })
  } catch (error) {
    console.error('Failed to load public-db stats:', error)
    return NextResponse.json(
      { success: false, error: '공개DB 통계를 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}
