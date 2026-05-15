import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

const ADMIN_ROLES = ['HEAD', 'ADMIN', 'CEO'] as const
type AdminRole = (typeof ADMIN_ROLES)[number]

// GET /api/contract-activities?limit=10
// 모든 직원 열람 가능. 최신 계약일 순.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '10', 10) || 10, 50)

    const list = await prisma.contractActivity.findMany({
      take: limit,
      orderBy: [{ contractDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        employee: { select: { id: true, name: true, position: true } },
      },
    })

    return NextResponse.json({ success: true, data: list })
  } catch (error) {
    console.error('Failed to load contract activities:', error)
    return NextResponse.json(
      { success: false, error: '계약 활동을 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}

// POST /api/contract-activities — 관리자만
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ADMIN_ROLES.includes(session.user.role as AdminRole)) {
      return NextResponse.json({ error: '관리자만 입력할 수 있습니다.' }, { status: 403 })
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
      return NextResponse.json(
        { error: '직원과 계약일은 필수입니다.' },
        { status: 400 },
      )
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

    // contractDate: "YYYY-MM-DD" (KST date) → UTC로 환산 (해당일 KST 00:00)
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

    const created = await prisma.contractActivity.create({
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
        createdById: session.user.id,
      },
      include: {
        employee: { select: { id: true, name: true, position: true } },
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'CREATE',
      entity: 'ContractActivity',
      entityId: created.id,
      changes: {
        employeeName: employee.name,
        customerName: created.customerName,
        unitNumber: created.unitNumber,
        unitType: created.unitType,
        commission: created.commission,
        contractDate: created.contractDate.toISOString(),
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({ success: true, data: created })
  } catch (error) {
    console.error('Failed to create contract activity:', error)
    return NextResponse.json(
      { success: false, error: '계약 활동 등록에 실패했습니다.' },
      { status: 500 },
    )
  }
}
