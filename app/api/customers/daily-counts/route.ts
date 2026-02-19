import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/customers/daily-counts - 날짜별 고객 등록 수 조회
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())
    const userId = searchParams.get('userId') || undefined
    const viewAll = searchParams.get('viewAll') === 'true'

    // 해당 월의 시작일과 종료일
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)

    // 권한에 따른 조건 설정
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isDeleted: false,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    }

    // 특정 직원 필터
    if (userId) {
      where.assignedUserId = userId
    } else if (session.user.role === 'EMPLOYEE' && !viewAll) {
      // 직원은 기본적으로 자기 고객만
      where.assignedUserId = session.user.id
    }

    // 날짜별 고객 수 집계
    const customers = await prisma.customer.findMany({
      where,
      select: {
        createdAt: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // 날짜별로 그룹화
    const dailyCounts: Record<string, { total: number; byUser: Record<string, { name: string; count: number }> }> = {}

    customers.forEach((customer) => {
      const dateKey = customer.createdAt.toISOString().split('T')[0] // YYYY-MM-DD

      if (!dailyCounts[dateKey]) {
        dailyCounts[dateKey] = { total: 0, byUser: {} }
      }

      dailyCounts[dateKey].total++

      if (customer.assignedUser) {
        const userId = customer.assignedUser.id
        if (!dailyCounts[dateKey].byUser[userId]) {
          dailyCounts[dateKey].byUser[userId] = {
            name: customer.assignedUser.name,
            count: 0,
          }
        }
        dailyCounts[dateKey].byUser[userId].count++
      }
    })

    // 배열 형태로 변환
    const result = Object.entries(dailyCounts).map(([date, data]) => ({
      date,
      total: data.total,
      byUser: Object.entries(data.byUser).map(([userId, userData]) => ({
        userId,
        name: userData.name,
        count: userData.count,
      })),
    }))

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        year,
        month,
        totalCustomers: customers.length,
      },
    })
  } catch (error) {
    console.error('Failed to fetch daily counts:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch daily counts' },
      { status: 500 }
    )
  }
}
