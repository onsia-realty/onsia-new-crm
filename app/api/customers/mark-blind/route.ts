import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'
import {
  BLIND_DB_TARGET_PER_USER,
  BLIND_ALLOCATION_REASON,
  BLIND_RECLAIM_REASON,
} from '@/lib/constants/blind-db'

const markBlindSchema = z.object({
  customerIds: z.array(z.string()).min(1, '고객을 1명 이상 선택해주세요.'),
  isBlind: z.boolean(),
})

const BATCH_SIZE = 500 // 고객 업데이트 / 배분 이력 생성 배치 크기

// PATCH /api/customers/mark-blind — 블라인드DB 전환/회수 (PENDING 제외 전 직원)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role === 'PENDING') {
      return NextResponse.json(
        { success: false, error: '승인 대기 중입니다. 관리자 승인 후 이용 가능합니다.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const validation = markBlindSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { customerIds, isBlind } = validation.data
    const isAdmin = ['ADMIN', 'CEO'].includes(session.user.role)
    // cutoff(blindAt)와 통화기록 경계를 흐트러뜨리지 않도록 배치 전체가 단일 시각을 쓴다
    const now = new Date()

    let count = 0

    if (isBlind) {
      // ── 전환: 본인 소유 고객만 (ADMIN/CEO는 본인 소유 또는 미배분도 허용) ──
      const unauthorizedCustomers = await prisma.customer.findMany({
        where: {
          id: { in: customerIds },
          isDeleted: false,
          ...(isAdmin
            ? // 관리자: 다른 직원 소유만 차단 (미배분은 허용)
              { assignedUserId: { notIn: [session.user.id], not: null } }
            : // 직원: 본인 소유 외 전부 차단 (미배분 포함).
              // nullable `not`은 NULL 행을 놓치므로 OR로 명시한다.
              {
                OR: [
                  { assignedUserId: null },
                  { assignedUserId: { not: session.user.id } },
                ],
              }),
        },
        select: { id: true },
      })

      if (unauthorizedCustomers.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `본인에게 배분된 고객만 블라인드DB로 보낼 수 있습니다. 권한 없는 고객 ${unauthorizedCustomers.length}명이 포함되어 있습니다.`,
          },
          { status: 403 }
        )
      }

      // 대상 후보 + 배분 이력용 기존 담당자
      const candidates = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: {
          id: true,
          phone: true,
          assignedUserId: true,
          isPublic: true,
          isBlind: true,
          isDeleted: true,
          grade: true,
        },
      })

      // 사장된 DB가 아닌 신호 → 실수 방지용으로 조용히 제외
      const [scheduledVisits, activeBlacklist] = await Promise.all([
        prisma.visitSchedule.findMany({
          where: {
            customerId: { in: customerIds },
            status: 'SCHEDULED',
            visitDate: { gte: now },
          },
          select: { customerId: true },
        }),
        prisma.blacklist.findMany({
          where: { phone: { in: candidates.map((c) => c.phone) }, isActive: true },
          select: { phone: true },
        }),
      ])
      const scheduledIds = new Set(scheduledVisits.map((v) => v.customerId))
      const blockedPhones = new Set(activeBlacklist.map((b) => b.phone))

      const eligible = candidates.filter(
        (c) =>
          !c.isDeleted &&
          !c.isPublic && // 공개DB와 상호배타
          !c.isBlind && // 이미 블라인드
          !blockedPhones.has(c.phone) &&
          !scheduledIds.has(c.id) &&
          c.grade !== 'A'
      )

      // 1단계: 고객 일괄 업데이트
      //  assignedUserId를 null로 미는 이유: 목록 이분 필터가 이 필드로 동작하므로 원
      //  소유자 화면에서 사라져야 하고, 클레임이 이 필드에 써야 한다. "누가 올렸나"는
      //  blindById가 담당한다.
      for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
        const batch = eligible.slice(i, i + BATCH_SIZE)
        const result = await prisma.customer.updateMany({
          where: { id: { in: batch.map((c) => c.id) } },
          data: {
            isBlind: true,
            blindAt: now,
            blindById: session.user.id,
            assignedUserId: null,
            assignedAt: null,
          },
        })
        count += result.count
      }

      // 2단계: 배분 이력 배치 생성
      for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
        const batch = eligible.slice(i, i + BATCH_SIZE)
        await prisma.customerAllocation.createMany({
          data: batch.map((customer) => ({
            customerId: customer.id,
            fromUserId: customer.assignedUserId,
            toUserId: null,
            allocatedById: session.user.id,
            reason: BLIND_ALLOCATION_REASON,
          })),
        })
      }
    } else {
      // ── 회수: 원 소유자에게 되돌린다 (등록자 본인 또는 ADMIN/CEO) ──
      const targets = await prisma.customer.findMany({
        where: { id: { in: customerIds }, isBlind: true, isDeleted: false },
        select: { id: true, blindById: true },
      })

      if (!isAdmin) {
        const unauthorizedCount = targets.filter(
          (c) => c.blindById !== session.user.id
        ).length
        if (unauthorizedCount > 0) {
          return NextResponse.json(
            {
              success: false,
              error: `본인이 올린 고객만 회수할 수 있습니다. 다른 직원이 올린 고객 ${unauthorizedCount}명이 포함되어 있습니다.`,
            },
            { status: 403 }
          )
        }
      }

      // updateMany로는 행별로 다른 blindById를 복원할 수 없으므로 원 소유자별로 묶는다
      const groups = new Map<string | null, string[]>()
      for (const target of targets) {
        const key = target.blindById
        const ids = groups.get(key)
        if (ids) ids.push(target.id)
        else groups.set(key, [target.id])
      }

      for (const [ownerId, ids] of groups) {
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const batch = ids.slice(i, i + BATCH_SIZE)
          const result = await prisma.customer.updateMany({
            where: { id: { in: batch }, isBlind: true, isDeleted: false },
            data: {
              isBlind: false,
              blindAt: null,
              blindById: null,
              assignedUserId: ownerId,
              assignedAt: now,
            },
          })
          count += result.count

          await prisma.customerAllocation.createMany({
            data: batch.map((customerId) => ({
              customerId,
              fromUserId: null,
              toUserId: ownerId,
              allocatedById: session.user.id,
              reason: BLIND_RECLAIM_REASON,
            })),
          })
        }
      }
    }

    // 진행률 — 쿼터는 강제하지 않고 표시만 한다
    const contributed = await prisma.customer.count({
      where: { isBlind: true, blindById: session.user.id, isDeleted: false },
    })
    const percent = Math.min(
      100,
      Math.round((contributed / BLIND_DB_TARGET_PER_USER) * 100)
    )

    await createAuditLog({
      userId: session.user.id,
      action: isBlind ? 'MARK_BLIND' : 'RECLAIM_BLIND',
      entity: 'Customer',
      entityId:
        customerIds.length <= 10 ? customerIds.join(',') : `${customerIds.length}건 일괄처리`,
      changes: { isBlind, count, skipped: customerIds.length - count },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    const skipped = customerIds.length - count
    return NextResponse.json({
      success: true,
      count,
      skipped,
      progress: { contributed, target: BLIND_DB_TARGET_PER_USER, percent },
      message: isBlind
        ? `${count.toLocaleString()}명을 블라인드DB로 보냈습니다. (내 누적 ${contributed}/${BLIND_DB_TARGET_PER_USER})` +
          (skipped > 0
            ? ` ${skipped}명은 공개DB/이미 등록/블랙리스트/방문예정/A등급으로 제외되었습니다.`
            : '')
        : `${count.toLocaleString()}명을 블라인드DB에서 회수했습니다.` +
          (skipped > 0 ? ` (${skipped}명은 이미 회수되었거나 대상이 아님)` : ''),
    })
  } catch (error) {
    console.error('Failed to mark blind:', error)
    return NextResponse.json(
      { success: false, error: '블라인드DB 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}
