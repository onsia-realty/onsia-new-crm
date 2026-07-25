import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { filterBlindCallLogs, isBlindHidden } from '@/lib/blind-db/mask'
import { z } from 'zod'

const createCallLogSchema = z.object({
  customerId: z.string(),
  content: z.string().min(1, '통화 내용을 입력해주세요'),
  note: z.string().optional(),
})

// POST /api/call-logs - 통화 기록 생성
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = createCallLogSchema.parse(body)

    const callLog = await prisma.callLog.create({
      data: {
        customerId: validated.customerId,
        userId: session.user.id,
        content: validated.content,
        note: validated.note,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: callLog })
  } catch (error) {
    console.error('Failed to create call log:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to create call log' },
      { status: 500 }
    )
  }
}

// GET /api/call-logs?customerId=xxx - 고객의 통화 기록 조회
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customerId = req.nextUrl.searchParams.get('customerId')
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId is required' },
        { status: 400 }
      )
    }

    // 블라인드DB 판정용 — 통화기록엔 작성자 실명과 이전 담당자의 판단이 그대로 남는다
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { isBlind: true, blindAt: true, blindById: true, assignedUserId: true },
    })

    const callLogs = await prisma.callLog.findMany({
      where: { customerId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (
      customer &&
      isBlindHidden({ id: session.user.id, role: session.user.role }, customer)
    ) {
      // blindAt 이후 기록만 공개(협업용). absenceCountTotal은 가려진 부재까지 포함해야
      // 상세 페이지의 부재 차수 계산이 "1차 부재"를 중복 생성하지 않는다.
      const { visible, hiddenCount, absenceCountTotal } = filterBlindCallLogs(
        callLogs,
        customer.blindAt
      )
      return NextResponse.json({
        success: true,
        data: visible,
        blindMasked: true,
        hiddenCallLogCount: hiddenCount,
        absenceCountTotal,
      })
    }

    return NextResponse.json({ success: true, data: callLogs })
  } catch (error) {
    console.error('Failed to fetch call logs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch call logs' },
      { status: 500 }
    )
  }
}
