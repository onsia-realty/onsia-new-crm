import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPeriodRange } from '@/lib/leaderboard/period'

// GET /api/visits/weekly-leaderboard
// 이번 주 직원별 방문 카운트 (완료/예정/노쇼 합산)
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { from, to } = getPeriodRange('week')

    // 활성 직원(EMPLOYEE/TEAM_LEADER) — visit-board 보드와 동일 정책
    const employees = await prisma.user.findMany({
      where: { role: { in: ['EMPLOYEE', 'TEAM_LEADER'] }, isActive: true },
      select: { id: true, name: true, position: true, department: true },
      orderBy: { name: 'asc' },
    })
    const userIds = employees.map((u) => u.id)

    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { rangeFrom: from.toISOString(), rangeTo: to.toISOString(), rankings: [], myRank: null },
      })
    }

    const visits = await prisma.visitSchedule.groupBy({
      by: ['userId', 'status'],
      where: {
        userId: { in: userIds },
        visitDate: { gte: from, lt: to },
      },
      _count: { _all: true },
    })

    const map = new Map<string, { checked: number; scheduled: number; noShow: number; total: number }>()
    visits.forEach((v) => {
      if (!v.userId) return
      if (!map.has(v.userId)) map.set(v.userId, { checked: 0, scheduled: 0, noShow: 0, total: 0 })
      const m = map.get(v.userId)!
      const count = v._count._all
      m.total += count
      if (v.status === 'CHECKED' || v.status === 'COMPLETED') m.checked += count
      else if (v.status === 'SCHEDULED' || v.status === 'RESCHEDULED') m.scheduled += count
      else if (v.status === 'NO_SHOW') m.noShow += count
    })

    const rows = employees.map((emp) => {
      const m = map.get(emp.id) ?? { checked: 0, scheduled: 0, noShow: 0, total: 0 }
      return {
        userId: emp.id,
        userName: emp.name,
        position: emp.position,
        department: emp.department,
        ...m,
      }
    })

    rows.sort((a, b) => b.total - a.total)
    let rank = 0
    let prev = Number.POSITIVE_INFINITY
    const ranked = rows.map((row, idx) => {
      if (row.total < prev) {
        rank = idx + 1
        prev = row.total
      }
      return { rank, ...row }
    })

    const rankings = ranked.filter((r) => r.total > 0)
    const myRank = rankings.find((r) => r.userId === session.user.id) ?? null

    return NextResponse.json({
      success: true,
      data: {
        rangeFrom: from.toISOString(),
        rangeTo: to.toISOString(),
        rankings,
        myRank,
      },
    })
  } catch (error) {
    console.error('Failed to compute weekly visit leaderboard:', error)
    return NextResponse.json(
      { success: false, error: '방문 순위를 계산하지 못했습니다.' },
      { status: 500 },
    )
  }
}
