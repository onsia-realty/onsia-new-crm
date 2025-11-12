import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/interest-cards - A등급 고객 조회 (관심카드)
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = session.user.role
    const isAdmin = role === 'ADMIN' || role === 'HEAD' || role === 'CEO'

    console.log('[Interest Cards] User:', session.user.email, 'Role:', role, 'IsAdmin:', isAdmin)

    // A등급 고객만 조회
    // ADMIN/HEAD/CEO는 전체, LEADER/EMPLOYEE는 자기 담당만
    const whereClause = {
      grade: 'A' as const,
      isDeleted: false,
      // 관리자가 아니면 자기가 담당하는 고객만
      ...(isAdmin ? {} : { assignedUserId: session.user.id }),
    }

    console.log('[Interest Cards] Where clause:', JSON.stringify(whereClause))

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
          },
        },
        visitSchedules: {
          where: {
            status: 'SCHEDULED',
            visitDate: {
              gte: new Date(), // 미래 일정만
            },
          },
          orderBy: {
            visitDate: 'asc',
          },
          take: 1, // 가장 가까운 일정 1개만
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log('[Interest Cards] Found', customers.length, 'customers')

    return NextResponse.json({ success: true, data: customers })
  } catch (error) {
    console.error('Failed to fetch interest cards:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch interest cards' },
      { status: 500 }
    )
  }
}
