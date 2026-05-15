import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

const ADMIN_ROLES = ['HEAD', 'ADMIN', 'CEO'] as const
type AdminRole = (typeof ADMIN_ROLES)[number]

// DELETE /api/contract-activities/[id] — 관리자만
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ADMIN_ROLES.includes(session.user.role as AdminRole)) {
      return NextResponse.json({ error: '관리자만 삭제할 수 있습니다.' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.contractActivity.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: '존재하지 않는 항목입니다.' }, { status: 404 })
    }

    await prisma.contractActivity.delete({ where: { id } })

    await createAuditLog({
      userId: session.user.id,
      action: 'DELETE',
      entity: 'ContractActivity',
      entityId: id,
      changes: {
        customerName: existing.customerName,
        unitNumber: existing.unitNumber,
        unitType: existing.unitType,
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete contract activity:', error)
    return NextResponse.json(
      { success: false, error: '삭제에 실패했습니다.' },
      { status: 500 },
    )
  }
}
