import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'
import { SITES } from '@/lib/constants/sites'
import { getBlindDbState } from '@/lib/blind-db/config'
import { BLIND_CLAIM_REASON } from '@/lib/constants/blind-db'

// POST /api/customers/[id]/blind-claim — 블라인드DB 고객 클레임 (내 DB로 가져오기)
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

    // 오픈 게이트 — 관리자가 오픈하기 전에는 아무도 가져갈 수 없다
    const state = await getBlindDbState()
    if (!state.open) {
      return NextResponse.json(
        { success: false, error: '블라인드DB가 아직 오픈되지 않았습니다.' },
        { status: 403 }
      )
    }

    // targetSite: 직원이 사전 선택한 이동 대상 현장 (선택적)
    let targetSite: string | null = null
    try {
      const body = await req.json().catch(() => null)
      if (body && typeof body.targetSite === 'string' && body.targetSite.trim()) {
        const site = body.targetSite.trim()
        if ((SITES as readonly string[]).includes(site)) {
          targetSite = site
        }
      }
    } catch {
      // body 없음 — targetSite 미지정으로 처리
    }

    // 트랜잭션으로 동시 클레임 방지
    const result = await prisma.$transaction(async (tx) => {
      // 1. 고객 조회 (트랜잭션 내 최신 상태)
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          isBlind: true,
          isPublic: true,
          isDeleted: true,
          assignedSite: true,
          blindAt: true,
          blindById: true,
        },
      })

      if (!customer || customer.isDeleted) {
        throw new ClaimError('고객을 찾을 수 없습니다.', 404)
      }

      if (!customer.isBlind) {
        throw new ClaimError('이미 다른 직원이 가져간 고객입니다.', 409)
      }

      if (customer.isPublic) {
        throw new ClaimError('공개DB 고객입니다.', 409)
      }

      // 본인이 올린 건은 클레임 불가 — 되돌리려면 회수 기능을 쓴다
      if (customer.blindById === session.user.id) {
        throw new ClaimError(
          '내가 블라인드DB로 보낸 고객입니다. 되돌리려면 회수 기능을 사용하세요.',
          403
        )
      }

      // blindAt이 없으면 cutoff를 정할 수 없다. 그대로 두면 필터가 무력화되어
      // 원 소유자 시절 기록으로 자격이 생기므로 막는다 (fail-closed).
      if (!customer.blindAt) {
        throw new ClaimError(
          '블라인드 등록 정보가 올바르지 않습니다. 관리자에게 문의해주세요.',
          409
        )
      }

      // 2. 해당 직원의 통화 기록 확인 — blindAt(등록 시점) 이후만 인정한다.
      //    cutoff가 없으면 원 소유자 시절의 과거 통화 기록으로 즉시 자격이 생긴다.
      const callLogs = await tx.callLog.findMany({
        where: {
          customerId,
          userId: session.user.id,
          createdAt: { gte: customer.blindAt },
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

      // 4. 클레임 처리 — 조건부 업데이트(CAS)로 동시 클레임 차단.
      //    blindAt/blindById는 집계·이력용으로 유지한다. isBlind=false이므로 마스킹은
      //    자동 해제되어 이름과 이전 기록이 전부 열린다.
      const now = new Date()
      const updated = await tx.customer.updateMany({
        where: { id: customerId, isBlind: true, isDeleted: false },
        data: {
          isBlind: false,
          assignedUserId: session.user.id,
          assignedAt: now,
          // targetSite가 지정되면 해당 현장으로 이동, 아니면 기존 값 유지
          ...(targetSite && { assignedSite: targetSite }),
        },
      })

      if (updated.count === 0) {
        throw new ClaimError('이미 다른 직원이 가져간 고객입니다.', 409)
      }

      // 5. 배분 이력 기록
      await tx.customerAllocation.create({
        data: {
          customerId,
          fromUserId: customer.blindById,
          toUserId: session.user.id,
          allocatedById: session.user.id,
          reason: targetSite
            ? `${BLIND_CLAIM_REASON} → 현장 이동: ${targetSite}`
            : BLIND_CLAIM_REASON,
        },
      })

      return { ...customer, previousSite: customer.assignedSite }
    })

    // 감사 로그 (트랜잭션 밖)
    await createAuditLog({
      userId: session.user.id,
      action: 'CLAIM_BLIND',
      entity: 'Customer',
      entityId: customerId,
      changes: {
        claimedBy: session.user.id,
        previousOwnerId: result.blindById,
        ...(targetSite && {
          siteMoved: { from: result.previousSite, to: targetSite },
        }),
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({
      success: true,
      message: targetSite
        ? `고객을 내 DB로 가져왔습니다. (현장: ${targetSite})`
        : '고객을 내 DB로 가져왔습니다.',
    })
  } catch (error) {
    if (error instanceof ClaimError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      )
    }

    console.error('Failed to claim blind customer:', error)
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
