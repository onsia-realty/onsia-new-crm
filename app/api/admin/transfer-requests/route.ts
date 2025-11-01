import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/transfer-requests - 담당자 변경 요청 목록 조회
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ADMIN, HEAD만 접근 가능
    if (!['ADMIN', 'HEAD'].includes(session.user.role)) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const status = searchParams.get('status') // PENDING, APPROVED, REJECTED
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // WHERE 조건 구성
    const where: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' } = {}
    if (status && (status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED')) {
      where.status = status
    }

    // 페이지네이션
    const skip = (page - 1) * limit

    const [transferRequests, total] = await Promise.all([
      prisma.transferRequest.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, phone: true }
          },
          fromUser: {
            select: { id: true, name: true, role: true }
          },
          toUser: {
            select: { id: true, name: true, role: true }
          },
          requestedBy: {
            select: { id: true, name: true }
          },
          approvedBy: {
            select: { id: true, name: true }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.transferRequest.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: transferRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Failed to fetch transfer requests:', error)
    return NextResponse.json(
      { error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
