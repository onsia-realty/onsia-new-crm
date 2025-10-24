import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/interest-cards - A등급 고객 조회 (관심카드)
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // A등급 고객만 조회
    const customers = await prisma.customer.findMany({
      where: {
        grade: 'A',
        isDeleted: false,
      },
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

    return NextResponse.json({ success: true, data: customers })
  } catch (error) {
    console.error('Failed to fetch interest cards:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch interest cards' },
      { status: 500 }
    )
  }
}
