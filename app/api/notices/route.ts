import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/notices - 공지사항 목록 조회
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notices = await prisma.notice.findMany({
      where: { isActive: true },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' }
      ],
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

    return NextResponse.json({
      success: true,
      notices
    })
  } catch (error) {
    console.error('Failed to fetch notices:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notices' },
      { status: 500 }
    )
  }
}

// POST /api/notices - 공지사항 생성
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || !['ADMIN', 'HEAD', 'TEAM_LEADER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { title, content, category, isPinned } = body

    if (!title || !content || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const notice = await prisma.notice.create({
      data: {
        title,
        content,
        category,
        isPinned: isPinned || false,
        authorId: session.user.id
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

    return NextResponse.json({
      success: true,
      notice
    })
  } catch (error) {
    console.error('Failed to create notice:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create notice' },
      { status: 500 }
    )
  }
}

// PATCH /api/notices - 공지사항 수정
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || !['ADMIN', 'HEAD', 'TEAM_LEADER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { id, title, content, category, isPinned } = body

    if (!id) {
      return NextResponse.json({ error: 'Notice ID required' }, { status: 400 })
    }

    const notice = await prisma.notice.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(category && { category }),
        ...(isPinned !== undefined && { isPinned })
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

    return NextResponse.json({
      success: true,
      notice
    })
  } catch (error) {
    console.error('Failed to update notice:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update notice' },
      { status: 500 }
    )
  }
}

// DELETE /api/notices - 공지사항 삭제 (soft delete)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || !['ADMIN', 'HEAD'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Notice ID required' }, { status: 400 })
    }

    await prisma.notice.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({
      success: true,
      message: 'Notice deleted successfully'
    })
  } catch (error) {
    console.error('Failed to delete notice:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete notice' },
      { status: 500 }
    )
  }
}
