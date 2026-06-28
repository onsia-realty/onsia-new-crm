import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPushToUsers } from '@/lib/push/send'
import { buildDailyVisitBriefing } from '@/lib/briefing/daily-visits'

export const dynamic = 'force-dynamic'

// 금일 방문 브리핑 — 매일 아침 08:00 KST (vercel.json cron: "0 23 * * *" UTC)
// 팀장 이상에게 웹푸시 발송 → 본부장이 /dashboard/briefing 에서 복사 후 단체방 공유.
// CRON_SECRET 으로 보호 (Vercel Cron 은 Authorization: Bearer ${CRON_SECRET} 자동 전송).

const BRIEFING_RECIPIENT_ROLES = ['TEAM_LEADER', 'HEAD', 'ADMIN', 'CEO'] as const

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET 가 설정되지 않았습니다.' },
      { status: 500 },
    )
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const briefing = await buildDailyVisitBriefing()

    const recipients = await prisma.user.findMany({
      where: {
        role: { in: [...BRIEFING_RECIPIENT_ROLES] },
        isActive: true,
      },
      select: { id: true },
    })
    const recipientIds = recipients.map((u) => u.id)

    const result = await sendPushToUsers(
      recipientIds,
      {
        title: '📋 당일 방문 보고',
        body: `오늘 방문 ${briefing.totalTeams}팀 — 탭하여 확인 후 단체방에 공유하세요`,
        url: '/dashboard/briefing',
        tag: `visit-briefing:${briefing.dateKey}`,
        icon: '/calls-icon-192.png',
        badge: '/calls-icon-192.png',
      },
      { kind: 'visitBriefing' },
    )

    return NextResponse.json({
      success: true,
      dateKey: briefing.dateKey,
      totalTeams: briefing.totalTeams,
      recipients: recipientIds.length,
      push: result,
    })
  } catch (error) {
    console.error('[cron/visit-briefing] failed:', error)
    return NextResponse.json(
      { success: false, error: '당일 방문 보고 발송에 실패했습니다.' },
      { status: 500 },
    )
  }
}
