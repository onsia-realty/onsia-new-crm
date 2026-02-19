import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

const bulkDeleteSchema = z.object({
  customerIds: z.array(z.string()).min(1, '고객을 1명 이상 선택해주세요.'),
})

const BATCH_SIZE = 500

// POST /api/customers/bulk-delete — 관리자 일괄 삭제 (소프트 삭제)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '관리자만 고객 삭제가 가능합니다.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const validation = bulkDeleteSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { customerIds } = validation.data

    // 본인 소유(또는 미배분) 고객만 삭제 허용 — 다른 직원 DB 보호
    const unauthorizedCustomers = await prisma.customer.findMany({
      where: {
        id: { in: customerIds },
        isDeleted: false,
        assignedUserId: { notIn: [session.user.id], not: null },
      },
      select: { id: true },
    })

    if (unauthorizedCustomers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `본인에게 배분된 고객만 삭제할 수 있습니다. 다른 직원 소유 고객 ${unauthorizedCustomers.length}명이 포함되어 있습니다.`,
        },
        { status: 403 }
      )
    }

    // 배치 단위로 소프트 삭제
    let totalDeleted = 0
    for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
      const batch = customerIds.slice(i, i + BATCH_SIZE)
      const result = await prisma.customer.updateMany({
        where: {
          id: { in: batch },
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          updatedAt: new Date(),
        },
      })
      totalDeleted += result.count
    }

    // 감사 로그
    await createAuditLog({
      userId: session.user.id,
      action: 'BULK_DELETE',
      entity: 'Customer',
      entityId: customerIds.length <= 10 ? customerIds.join(',') : `${customerIds.length}건 일괄삭제`,
      changes: { count: totalDeleted },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({
      success: true,
      message: `${totalDeleted.toLocaleString()}명의 고객을 삭제했습니다.`,
      count: totalDeleted,
    })
  } catch (error) {
    console.error('Failed to bulk delete:', error)
    return NextResponse.json(
      { success: false, error: '고객 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
