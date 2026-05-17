import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

const ADMIN_ROLES = ['HEAD', 'ADMIN', 'CEO'] as const
type AdminRole = (typeof ADMIN_ROLES)[number]

// PATCH /api/contract-activities/[id] — 관리자만
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ADMIN_ROLES.includes(session.user.role as AdminRole)) {
      return NextResponse.json({ error: '관리자만 수정할 수 있습니다.' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.contractActivity.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: '존재하지 않는 항목입니다.' }, { status: 404 })
    }

    const body = await req.json()
    const {
      employeeId,
      siteName,
      customerName,
      unitNumber,
      unitType,
      source,
      commission,
      contractDate,
      memo,
    } = body as {
      employeeId?: string
      siteName?: string
      customerName?: string
      unitNumber?: string
      unitType?: string
      source?: string
      commission?: number | string | null
      contractDate?: string
      memo?: string
    }

    const VALID_SOURCES = ['AD', 'TM', 'WALKING', 'CAR_ORDER', 'FIELD', 'REFERRAL', 'OCR'] as const
    type ValidSource = (typeof VALID_SOURCES)[number]
    const sourceEnum: ValidSource | null =
      source && (VALID_SOURCES as readonly string[]).includes(source) ? (source as ValidSource) : null

    if (!employeeId || !contractDate) {
      return NextResponse.json({ error: '직원과 계약일은 필수입니다.' }, { status: 400 })
    }
    if (!customerName?.trim() && !unitNumber?.trim()) {
      return NextResponse.json(
        { error: '계약자 이름 또는 동·호실 중 하나는 입력해야 합니다.' },
        { status: 400 },
      )
    }

    let commissionInt: number | null = null
    if (commission !== undefined && commission !== null && commission !== '') {
      const n = typeof commission === 'number' ? commission : parseInt(String(commission).replace(/[^0-9-]/g, ''), 10)
      if (Number.isFinite(n) && n >= 0) commissionInt = n
    }

    const [y, m, d] = contractDate.split('-').map(Number)
    if (!y || !m || !d) {
      return NextResponse.json({ error: '계약일 형식이 잘못되었습니다.' }, { status: 400 })
    }
    const kst = new Date(y, m - 1, d, 0, 0, 0, 0)
    const utc = new Date(kst.getTime() - 9 * 60 * 60 * 1000)

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true },
    })
    if (!employee) {
      return NextResponse.json({ error: '존재하지 않는 직원입니다.' }, { status: 404 })
    }

    const updated = await prisma.contractActivity.update({
      where: { id },
      data: {
        employeeId,
        siteName: siteName?.trim() || null,
        customerName: customerName?.trim() || null,
        unitNumber: unitNumber?.trim() || null,
        unitType: unitType?.trim() || null,
        source: sourceEnum,
        commission: commissionInt,
        contractDate: utc,
        memo: memo?.trim() || null,
      },
      include: {
        employee: { select: { id: true, name: true, position: true } },
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'ContractActivity',
      entityId: id,
      changes: {
        before: {
          employeeId: existing.employeeId,
          customerName: existing.customerName,
          unitNumber: existing.unitNumber,
          unitType: existing.unitType,
          commission: existing.commission,
          contractDate: existing.contractDate.toISOString(),
        },
        after: {
          employeeId: updated.employeeId,
          customerName: updated.customerName,
          unitNumber: updated.unitNumber,
          unitType: updated.unitType,
          commission: updated.commission,
          contractDate: updated.contractDate.toISOString(),
        },
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Failed to update contract activity:', error)
    return NextResponse.json(
      { success: false, error: '계약 활동 수정에 실패했습니다.' },
      { status: 500 },
    )
  }
}

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
