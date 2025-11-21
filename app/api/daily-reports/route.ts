import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getKoreaToday, getKoreaTodayStart, getKoreaTodayEnd } from '@/lib/date-utils'

// 업무보고 조회/생성 스키마
const reportQuerySchema = z.object({
  date: z.string().optional(),
  userId: z.string().optional(),
})

const reportUpdateSchema = z.object({
  note: z.string().optional(),
})

// GET - 업무보고 조회 (관리자: 전체, 직원: 본인)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')
    const userId = searchParams.get('userId')

    // 한국 시간 기준 날짜
    const targetDate = dateStr ? new Date(dateStr) : getKoreaToday()

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    const isAdmin = ['ADMIN', 'CEO', 'HEAD', 'TEAM_LEADER'].includes(user?.role || '')

    // 관리자는 전체 조회, 직원은 본인만
    const whereClause: { date: Date; userId?: string } = { date: targetDate }

    if (userId && isAdmin) {
      whereClause.userId = userId
    } else if (!isAdmin) {
      whereClause.userId = session.user.id
    }

    const reports = await prisma.dailyReport.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            department: true,
            position: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // 보고서에 방문일정 및 계약 정보 추가
    const reportsWithData = await Promise.all(
      reports.map(async (report) => {
        const [visits, contracts] = await Promise.all([
          // 오늘 등록한 방문 일정 (금일 잡은 내역)
          prisma.visitSchedule.findMany({
            where: {
              userId: report.userId,
              createdAt: {
                gte: targetDate,
                lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
              }
            },
            include: {
              customer: {
                select: { name: true, phone: true }
              }
            },
            orderBy: { visitDate: 'asc' }
          }),
          // 오늘 등록된 계약 (InterestCard)
          prisma.interestCard.findMany({
            where: {
              customer: {
                assignedUserId: report.userId
              },
              createdAt: {
                gte: targetDate,
                lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
              }
            },
            include: {
              customer: {
                select: { id: true, name: true, phone: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          })
        ])
        return { ...report, visits, contracts }
      })
    )

    return NextResponse.json(reportsWithData)
  } catch (error) {
    console.error('업무보고 조회 오류:', error)
    return NextResponse.json({ error: '업무보고 조회에 실패했습니다.' }, { status: 500 })
  }
}

// POST - 업무보고 생성/수정
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = reportUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }

    // 한국 시간 기준
    const today = getKoreaToday()
    const todayStart = getKoreaTodayStart()
    const todayEnd = getKoreaTodayEnd()

    // 오늘 통계 자동 집계
    const [customersCount, allocationsCount, callLogsCount, contractsCount, subscriptionsCount] = await Promise.all([
      // 오늘 등록한 고객 수
      prisma.customer.count({
        where: {
          assignedUserId: session.user.id,
          createdAt: { gte: todayStart, lt: todayEnd }
        }
      }),
      // 오늘 배분받은 고객 수
      prisma.customerAllocation.count({
        where: {
          toUserId: session.user.id,
          createdAt: { gte: todayStart, lt: todayEnd }
        }
      }),
      // 오늘 생성한 통화 기록 수
      prisma.callLog.count({
        where: {
          userId: session.user.id,
          createdAt: { gte: todayStart, lt: todayEnd }
        }
      }),
      // 오늘 등록한 계약 수 (COMPLETED)
      prisma.interestCard.count({
        where: {
          customer: { assignedUserId: session.user.id },
          status: 'COMPLETED',
          createdAt: { gte: todayStart, lt: todayEnd }
        }
      }),
      // 오늘 등록한 청약 수 (ACTIVE)
      prisma.interestCard.count({
        where: {
          customer: { assignedUserId: session.user.id },
          status: 'ACTIVE',
          createdAt: { gte: todayStart, lt: todayEnd }
        }
      })
    ])

    // 업무보고 생성 또는 업데이트
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
        allocationsReceived: allocationsCount,
        callLogsCreated: callLogsCount,
        memosCreated: callLogsCount, // 통화 기록 = 메모
        contractsCount: contractsCount,
        subscriptionsCount: subscriptionsCount,
        note: parsed.data.note,
      },
      update: {
        customersCreated: customersCount,
        allocationsReceived: allocationsCount,
        callLogsCreated: callLogsCount,
        memosCreated: callLogsCount, // 통화 기록 = 메모
        contractsCount: contractsCount,
        subscriptionsCount: subscriptionsCount,
        ...(parsed.data.note !== undefined && { note: parsed.data.note }),
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

    return NextResponse.json(report)
  } catch (error) {
    console.error('업무보고 저장 오류:', error)
    return NextResponse.json({ error: '업무보고 저장에 실패했습니다.' }, { status: 500 })
  }
}
