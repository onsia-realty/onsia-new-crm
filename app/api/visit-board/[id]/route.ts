import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

type BoardRole = 'EMPLOYEE' | 'TEAM_LEADER' | 'HEAD' | 'ADMIN' | 'CEO'
const ADMIN_ROLES: BoardRole[] = ['HEAD', 'ADMIN', 'CEO']

// PATCH /api/visit-board/[id]
// - confirmStatus 토글 (🟢 UNCHANGED → 🔵 CHANGED → 🔴 NO_SHOW → 해제)
// - 방문 시간/메모 수정. CHANGED 시 previousDate에 기존 시각 보관.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const {
      confirmStatus,
      visitDate, // "YYYY-MM-DDTHH:mm" KST
      memo,
    } = body as {
      confirmStatus?: 'UNCHANGED' | 'CHANGED' | 'NO_SHOW' | null
      visitDate?: string | null
      memo?: string
    }

    const existing = await prisma.visitSchedule.findUnique({
      where: { id },
      include: { customer: { select: { name: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: '방문 일정을 찾을 수 없습니다.' }, { status: 404 })
    }

    const isAdmin = ADMIN_ROLES.includes(session.user.role as BoardRole)
    const isOwner = existing.userId === session.user.id
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const data: {
      confirmStatus?: 'UNCHANGED' | 'CHANGED' | 'NO_SHOW' | null
      confirmedAt?: Date | null
      status?: 'SCHEDULED' | 'NO_SHOW'
      previousDate?: Date | null
      visitDate?: Date
      memo?: string | null
    } = {}

    if (confirmStatus !== undefined) {
      data.confirmStatus = confirmStatus
      data.confirmedAt = confirmStatus ? new Date() : null
      // NO_SHOW 마킹 시 VisitStatus도 동기화 (집계용)
      if (confirmStatus === 'NO_SHOW') {
        data.status = 'NO_SHOW'
      } else if (confirmStatus && existing.status === 'NO_SHOW') {
        data.status = 'SCHEDULED'
      }
    }

    if (visitDate !== undefined) {
      if (visitDate === null || visitDate === '') {
        // 시간 미정 처리는 별도; 여기서는 무시
      } else {
        const [datePart, timePart] = visitDate.split('T')
        const [y, mo, d] = datePart.split('-').map(Number)
        const [hh, mm] = (timePart || '00:00').split(':').map(Number)
        const kst = new Date(y, mo - 1, d, hh, mm, 0, 0)
        const newUtc = new Date(kst.getTime() - 9 * 60 * 60 * 1000)
        if (newUtc.getTime() !== existing.visitDate.getTime()) {
          data.previousDate = existing.visitDate
          // 시간을 직접 바꾸면 자동으로 "변동됨" 표시
          if (confirmStatus === undefined) {
            data.confirmStatus = 'CHANGED'
            data.confirmedAt = new Date()
          }
        }
        data.visitDate = newUtc
      }
    }

    if (memo !== undefined) {
      data.memo = memo
    }

    const updated = await prisma.visitSchedule.update({
      where: { id },
      data,
      include: {
        customer: { select: { id: true, name: true, phone: true, assignedSite: true } },
        user: { select: { id: true, name: true, position: true } },
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'UPDATE_VISIT_SCHEDULE',
      entity: 'VisitSchedule',
      entityId: id,
      changes: {
        confirmStatus: data.confirmStatus ?? null,
        visitDate: data.visitDate?.toISOString() ?? null,
        customerName: existing.customer.name,
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Failed to update visit-board entry:', error)
    return NextResponse.json(
      { success: false, error: '방문 변동사항 업데이트에 실패했습니다.' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.visitSchedule.findUnique({
      where: { id },
      include: { customer: { select: { name: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: '방문 일정을 찾을 수 없습니다.' }, { status: 404 })
    }

    const isAdmin = ADMIN_ROLES.includes(session.user.role as BoardRole)
    const isOwner = existing.userId === session.user.id
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    await prisma.visitSchedule.delete({ where: { id } })

    await createAuditLog({
      userId: session.user.id,
      action: 'DELETE_VISIT_SCHEDULE',
      entity: 'VisitSchedule',
      entityId: id,
      changes: { customerName: existing.customer.name, visitDate: existing.visitDate },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete visit-board entry:', error)
    return NextResponse.json(
      { success: false, error: '방문 삭제에 실패했습니다.' },
      { status: 500 },
    )
  }
}
