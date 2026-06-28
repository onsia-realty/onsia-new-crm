import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buildDailyVisitBriefing } from '@/lib/briefing/daily-visits'

export const dynamic = 'force-dynamic'

// 당일 방문 보고 조회 — 로그인한 전 직원 열람 가능
// GET /api/briefing/daily-visits?date=YYYY-MM-DD (기본: 오늘 KST)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const date = req.nextUrl.searchParams.get('date')
    const briefing = date
      ? await buildDailyVisitBriefing(date)
      : await buildDailyVisitBriefing()
    return NextResponse.json({ success: true, data: briefing })
  } catch (error) {
    console.error('[api/briefing/daily-visits] failed:', error)
    return NextResponse.json(
      { success: false, error: '당일 방문 보고를 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}
