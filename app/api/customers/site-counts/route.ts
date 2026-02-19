import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/customers/site-counts — 현장별 고객 수 집계
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const userId = searchParams.get('userId') || undefined
    const viewAll = searchParams.get('viewAll') === 'true'
    const isPublicMode = searchParams.get('isPublic') === 'true'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isDeleted: false,
      isPublic: isPublicMode,
    }

    // 사용자 필터
    if (userId) {
      where.assignedUserId = userId
    } else if (session.user.role === 'EMPLOYEE' && !viewAll) {
      where.assignedUserId = session.user.id
    }

    // 비공개 고객 현장별 집계
    const grouped = await prisma.customer.groupBy({
      by: ['assignedSite'],
      where,
      _count: { id: true },
    })

    // 공개DB 고객 수 (현장별 필터와 무관하게 별도 집계)
    const publicCount = await prisma.customer.count({
      where: { isDeleted: false, isPublic: true },
    })

    // 전체 = 현재 필터 결과 + 공개DB
    const filteredTotal = grouped.reduce((sum, g) => sum + g._count.id, 0)

    const counts: Record<string, number> = {
      '전체': filteredTotal + publicCount,
      '공개DB': publicCount,
    }

    // 현장 이름 목록 (순서 보장)
    const sites: string[] = []
    grouped
      .sort((a, b) => b._count.id - a._count.id) // 많은 순 정렬
      .forEach((g) => {
        const site = g.assignedSite || '미지정'
        counts[site] = g._count.id
        sites.push(site)
      })

    return NextResponse.json({ success: true, counts, sites })
  } catch (error) {
    console.error('Failed to fetch site counts:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch site counts' },
      { status: 500 }
    )
  }
}
