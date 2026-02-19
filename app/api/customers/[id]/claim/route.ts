import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

// POST /api/customers/[id]/claim — 공개DB 고객 클레임 (내 DB로 가져오기)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params

  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 트랜잭션으로 동시 클레임 방지
    const result = await prisma.$transaction(async (tx) => {
      // 1. 고객 조회 (트랜잭션 내 최신 상태)
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { id: true, isPublic: true, isDeleted: true, name: true },
      })

      if (!customer || customer.isDeleted) {
        throw new ClaimError('고객을 찾을 수 없습니다.', 404)
      }

      if (!customer.isPublic) {
        throw new ClaimError('이미 다른 직원이 가져간 고객입니다.', 409)
      }

      // 2. 해당 직원의 통화 기록 확인
      const callLogs = await tx.callLog.findMany({
        where: {
          customerId,
          userId: session.user.id,
        },
        select: { content: true },
        orderBy: { createdAt: 'desc' },
      })

      if (callLogs.length === 0) {
        throw new ClaimError('통화 기록이 없습니다. 먼저 통화를 진행해주세요.', 400)
      }

      // 3. 부재 기록만 있는지 검사
      const hasRealCall = callLogs.some(
        (log) => !log.content.includes('부재')
      )

      if (!hasRealCall) {
        throw new ClaimError(
          '부재 기록만 있습니다. 정상 통화 후 가져올 수 있습니다.',
          400
        )
      }

      // 4. 클레임 처리
      const now = new Date()
      await tx.customer.update({
        where: { id: customerId },
        data: {
          isPublic: false,
          assignedUserId: session.user.id,
          assignedAt: now,
          publicAt: null,
          publicById: null,
        },
      })

      // 5. 배분 이력 기록
      await tx.customerAllocation.create({
        data: {
          customerId,
          fromUserId: null,
          toUserId: session.user.id,
          allocatedById: session.user.id,
          reason: '공개DB에서 클레임',
        },
      })

      return customer
    })

    // 감사 로그 (트랜잭션 밖)
    await createAuditLog({
      userId: session.user.id,
      action: 'CLAIM_PUBLIC',
      entity: 'Customer',
      entityId: customerId,
      changes: { claimedBy: session.user.id, customerName: result.name },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({
      success: true,
      message: '고객을 내 DB로 가져왔습니다.',
    })
  } catch (error) {
    if (error instanceof ClaimError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      )
    }

    console.error('Failed to claim customer:', error)
    return NextResponse.json(
      { success: false, error: '고객 클레임에 실패했습니다.' },
      { status: 500 }
    )
  }
}

class ClaimError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ClaimError'
  }
}
