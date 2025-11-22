import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/unallocated-customers - 미배분 고객 목록 조회 (관리자 전용)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ADMIN만 접근 가능
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const site = searchParams.get('site') // 현장 필터
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '150')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      // 미배분 조건: assignedUserId가 null이거나, 직원이 아닌 역할(ADMIN)에게 배분된 경우
      OR: [
        { assignedUserId: null },
        {
          assignedUser: {
            role: {
              notIn: ['EMPLOYEE', 'TEAM_LEADER', 'HEAD']
            }
          }
        }
      ],
      // 현장 필터
      ...(site && site !== '전체' && site !== 'all' && {
        assignedSite: site === 'null' ? null : site
      }),
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedUser: {
            select: { id: true, name: true, email: true, role: true },
          },
          _count: {
            select: {
              interestCards: true,
              visitSchedules: true,
              callLogs: true,
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Failed to fetch unallocated customers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}
