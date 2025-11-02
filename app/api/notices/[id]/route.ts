import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/notices/[id] - 공지사항 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const notice = await prisma.notice.findUnique({
      where: {
        id,
        isActive: true
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!notice) {
      return NextResponse.json(
        { error: 'Notice not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      notice
    })
  } catch (error) {
    console.error('Failed to fetch notice:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notice' },
      { status: 500 }
    )
  }
}
