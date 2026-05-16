import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getKoreaToday } from '@/lib/date-utils'

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

    // targetDate: DailyReport.date (@db.Date) 조회용 — KST 캘린더 날짜의 UTC 자정
    // todayStart/todayEnd: visit/customer/callLog createdAt timestamp 비교용 — KST 자정의 UTC ms (-9h)
    const targetDate = dateStr ? new Date(dateStr + 'T00:00:00.000Z') : getKoreaToday()
    const todayStart = new Date(targetDate.getTime() - 9 * 60 * 60 * 1000)
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

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

    // 직원별 통계 집계 - 한 번에 그룹별 집계 (N+1 문제 해결)
    const userIds = activeUsers.map(u => u.id)

    // 고객 등록 통계 한 번에 조회
    const customerCounts = await prisma.customer.groupBy({
      by: ['assignedUserId'],
      where: {
        assignedUserId: { in: userIds },
        createdAt: { gte: todayStart, lt: todayEnd }
      },
      _count: { id: true }
    })
    const customerCountMap = new Map(
      customerCounts.map(c => [c.assignedUserId, c._count.id])
    )

    // 통화 기록 통계 한 번에 조회
    const callLogCounts = await prisma.callLog.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        createdAt: { gte: todayStart, lt: todayEnd }
      },
      _count: { id: true }
    })
    const callLogCountMap = new Map(
      callLogCounts.map(c => [c.userId, c._count.id])
    )

    // 부재중 통화 통계 한 번에 조회
    const missedCallCounts = await prisma.callLog.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        content: { contains: '부재' },
        createdAt: { gte: todayStart, lt: todayEnd }
      },
      _count: { id: true }
    })
    const missedCallCountMap = new Map(
      missedCallCounts.map(c => [c.userId, c._count.id])
    )

    // 공개DB 전환(클레임) 통계 — DISTINCT customerId per user
    const publicClaims = await prisma.customerAllocation.findMany({
      where: {
        toUserId: { in: userIds },
        reason: { startsWith: '공개DB에서 클레임' },
        createdAt: { gte: todayStart, lt: todayEnd }
      },
      select: { toUserId: true, customerId: true }
    })
    const publicClaimMap = new Map<string, Set<string>>()
    publicClaims.forEach(a => {
      if (!a.toUserId) return
      if (!publicClaimMap.has(a.toUserId)) publicClaimMap.set(a.toUserId, new Set())
      publicClaimMap.get(a.toUserId)!.add(a.customerId)
    })

    // 직원별 방문 일정 맵 생성
    const visitsMap = new Map<string, typeof visits>()
    visits.forEach(v => {
      if (v.userId) {
        if (!visitsMap.has(v.userId)) {
          visitsMap.set(v.userId, [])
        }
        visitsMap.get(v.userId)!.push(v)
      }
    })

    // 리포트 맵 생성
    const reportMap = new Map(reports.map(r => [r.userId, r]))

    const userStats = activeUsers.map((u) => {
      const report = reportMap.get(u.id)
      const userVisits = visitsMap.get(u.id) || []
      const customersCreated = customerCountMap.get(u.id) || 0
      const callLogsCreated = callLogCountMap.get(u.id) || 0
      const missedCallsCount = missedCallCountMap.get(u.id) || 0
      const publicClaimCount = publicClaimMap.get(u.id)?.size || 0

      return {
        user: u,
        report: report || null,
        stats: {
          customersCreated,
          callLogsCreated,
          missedCallsCount,
          publicClaimCount,
          memosCreated: callLogsCreated,
        },
        visits: userVisits,
        hasReport: !!report,
        hasClockedIn: !!report?.clockIn,
        hasClockedOut: !!report?.clockOut,
      }
    })

    // 요약 통계
    const summary = {
      totalUsers: activeUsers.length,
      reportedUsers: reports.length,
      clockedInUsers: reports.filter(r => r.clockIn).length,
      clockedOutUsers: reports.filter(r => r.clockOut).length,
      totalCustomers: userStats.reduce((sum, u) => sum + u.stats.customersCreated, 0),
      totalPublicClaims: userStats.reduce((sum, u) => sum + u.stats.publicClaimCount, 0),
      totalCallLogs: userStats.reduce((sum, u) => sum + u.stats.callLogsCreated, 0),
      totalMissedCalls: userStats.reduce((sum, u) => sum + u.stats.missedCallsCount, 0),
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
