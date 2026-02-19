import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

const markPublicSchema = z.object({
  customerIds: z.array(z.string()).min(1, '고객을 1명 이상 선택해주세요.'),
  isPublic: z.boolean(),
})

const BATCH_SIZE = 500 // 배분 이력 생성 배치 크기

// PATCH /api/customers/mark-public — 공개DB 전환/해제 (ADMIN/CEO 전용)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['ADMIN', 'CEO'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: '관리자만 공개DB 전환이 가능합니다.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const validation = markPublicSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { customerIds, isPublic } = validation.data
    const now = new Date()

    // 공개 전환 시: 본인 소유(또는 미배분) 고객만 허용 — 다른 직원 DB 보호
    if (isPublic) {
      const unauthorizedCustomers = await prisma.customer.findMany({
        where: {
          id: { in: customerIds },
          isDeleted: false,
          assignedUserId: { notIn: [session.user.id], not: null },
        },
        select: { id: true, assignedUserId: true },
      })

      if (unauthorizedCustomers.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `본인에게 배분된 고객만 공개DB로 전환할 수 있습니다. 다른 직원 소유 고객 ${unauthorizedCustomers.length}명이 포함되어 있습니다.`,
          },
          { status: 403 }
        )
      }
    }

    // 공개 전환 시: 배분 이력용으로 기존 담당자 정보 먼저 조회
    let previousAssignments: Array<{ id: string; assignedUserId: string | null }> = []
    if (isPublic) {
      previousAssignments = await prisma.customer.findMany({
        where: { id: { in: customerIds }, isDeleted: false },
        select: { id: true, assignedUserId: true },
      })
    }

    // 1단계: 고객 일괄 업데이트 (updateMany — 빠름)
    const updateData = isPublic
      ? {
          isPublic: true,
          publicAt: now,
          publicById: session.user.id,
          assignedUserId: null as string | null,
          assignedAt: null as Date | null,
        }
      : {
          isPublic: false,
          publicAt: null as Date | null,
          publicById: null as string | null,
        }

    const updateResult = await prisma.customer.updateMany({
      where: {
        id: { in: customerIds },
        isDeleted: false,
      },
      data: updateData,
    })

    // 2단계: 배분 이력 배치 생성 (공개 전환 시에만)
    if (isPublic && previousAssignments.length > 0) {
      for (let i = 0; i < previousAssignments.length; i += BATCH_SIZE) {
        const batch = previousAssignments.slice(i, i + BATCH_SIZE)
        await prisma.customerAllocation.createMany({
          data: batch.map((customer) => ({
            customerId: customer.id,
            fromUserId: customer.assignedUserId,
            toUserId: null,
            allocatedById: session.user.id,
            reason: '공개DB로 전환',
          })),
        })
      }
    }

    // 3단계: 감사 로그
    await createAuditLog({
      userId: session.user.id,
      action: 'MARK_PUBLIC',
      entity: 'Customer',
      entityId: customerIds.length <= 10 ? customerIds.join(',') : `${customerIds.length}건 일괄처리`,
      changes: { isPublic, count: updateResult.count },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({
      success: true,
      message: isPublic
        ? `${updateResult.count.toLocaleString()}명의 고객을 공개DB로 전환했습니다.`
        : `${updateResult.count.toLocaleString()}명의 고객을 공개DB에서 해제했습니다.`,
      count: updateResult.count,
    })
  } catch (error) {
    console.error('Failed to mark public:', error)
    return NextResponse.json(
      { success: false, error: '공개DB 전환에 실패했습니다.' },
      { status: 500 }
    )
  }
}
