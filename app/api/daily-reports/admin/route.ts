import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getKoreaToday, getKoreaTodayStart, getKoreaTodayEnd } from '@/lib/date-utils'

// GET - 관리자용 전체 업무보고 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 권한 체크
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!['ADMIN', 'CEO', 'HEAD', 'TEAM_LEADER'].includes(user?.role || '')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')

    // 한국 시간 기준
    const targetDate = dateStr ? new Date(dateStr) : getKoreaToday()
    const todayStart = new Date(targetDate)
    const todayEnd = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)

    // 활성 직원 목록 조회
    const activeUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { not: 'PENDING' }
      },
      select: {
        id: true,
        name: true,
        username: true,
        department: true,
        position: true,
        role: true,
      },
      orderBy: { name: 'asc' }
    })

    // 해당 날짜의 모든 업무보고 조회
    const reports = await prisma.dailyReport.findMany({
      where: { date: targetDate },
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
      }
    })

    // 직원별 방문일정 조회
    const visits = await prisma.visitSchedule.findMany({
      where: {
        visitDate: { gte: todayStart, lt: todayEnd }
      },
      include: {
        customer: {
          select: { name: true, phone: true }
        },
        user: {
          select: { id: true, name: true }
        }
      },
      orderBy: { visitDate: 'asc' }
    })

    // 직원별 통계 집계
    const userStats = await Promise.all(
      activeUsers.map(async (u) => {
        const [customersCount, callLogsCount] = await Promise.all([
          prisma.customer.count({
            where: {
              assignedUserId: u.id,
              createdAt: { gte: todayStart, lt: todayEnd }
            }
          }),
          prisma.callLog.count({
            where: {
              userId: u.id,
              createdAt: { gte: todayStart, lt: todayEnd }
            }
          })
        ])

        const report = reports.find(r => r.userId === u.id)
        const userVisits = visits.filter(v => v.userId === u.id)

        return {
          user: u,
          report: report || null,
          stats: {
            customersCreated: customersCount,
            callLogsCreated: callLogsCount,
            memosCreated: callLogsCount,
          },
          visits: userVisits,
          hasReport: !!report,
          hasClockedIn: !!report?.clockIn,
          hasClockedOut: !!report?.clockOut,
        }
      })
    )

    // 요약 통계
    const summary = {
      totalUsers: activeUsers.length,
      reportedUsers: reports.length,
      clockedInUsers: reports.filter(r => r.clockIn).length,
      clockedOutUsers: reports.filter(r => r.clockOut).length,
      totalCustomers: userStats.reduce((sum, u) => sum + u.stats.customersCreated, 0),
      totalCallLogs: userStats.reduce((sum, u) => sum + u.stats.callLogsCreated, 0),
      totalContracts: reports.reduce((sum, r) => sum + r.contractsCount, 0),
      totalSubscriptions: reports.reduce((sum, r) => sum + r.subscriptionsCount, 0),
      totalVisits: visits.length,
    }

    return NextResponse.json({
      date: targetDate,
      summary,
      userStats,
    })
  } catch (error) {
    console.error('업무보고 관리자 조회 오류:', error)
    return NextResponse.json({ error: '업무보고 조회에 실패했습니다.' }, { status: 500 })
  }
}
