import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const clockSchema = z.object({
  type: z.enum(['in', 'out']),
})

// POST - 출근/퇴근 기록
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = clockSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }

    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayStart = new Date(today)
    const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000)

    // 오늘 통계 자동 집계
    const [customersCount, callLogsCount] = await Promise.all([
      prisma.customer.count({
        where: {
          assignedUserId: session.user.id,
          createdAt: { gte: todayStart, lt: todayEnd }
        }
      }),
      prisma.callLog.count({
        where: {
          userId: session.user.id,
          createdAt: { gte: todayStart, lt: todayEnd }
        }
      })
    ])

    const updateData = parsed.data.type === 'in'
      ? { clockIn: now }
      : { clockOut: now }

    const report = await prisma.dailyReport.upsert({
      where: {
        userId_date: {
          userId: session.user.id,
          date: today
        }
      },
      create: {
        userId: session.user.id,
        date: today,
        customersCreated: customersCount,
        callLogsCreated: callLogsCount,
        memosCreated: callLogsCount,
        ...updateData
      },
      update: {
        customersCreated: customersCount,
        callLogsCreated: callLogsCount,
        memosCreated: callLogsCount,
        ...updateData
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          }
        }
      }
    })

    const message = parsed.data.type === 'in' ? '출근이 기록되었습니다.' : '퇴근이 기록되었습니다.'
    return NextResponse.json({ ...report, message })
  } catch (error) {
    console.error('출퇴근 기록 오류:', error)

    // Prisma 에러 처리
    const prismaError = error as { code?: string; message?: string }
    if (prismaError.code === 'P2021') {
      return NextResponse.json({
        error: 'DailyReport 테이블이 존재하지 않습니다. DB 마이그레이션을 실행해주세요.'
      }, { status: 500 })
    }

    return NextResponse.json({
      error: prismaError.message || '출퇴근 기록에 실패했습니다.'
    }, { status: 500 })
  }
}
