import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

const bulkUpdateSiteSchema = z.object({
  customerIds: z.array(z.string()).min(1, '고객을 1명 이상 선택해주세요.'),
  site: z.string().max(50).optional().default(''), // 빈 문자열 = 미지정으로 변경
})

const BATCH_SIZE = 500

// POST /api/customers/bulk-update-site — 선택 고객의 현장(assignedSite) 일괄 이동
// 직원: 본인에게 배분된 고객만 이동 가능 / 관리자: 전체 이동 가능
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role === 'PENDING') {
      return NextResponse.json(
        { success: false, error: '승인 대기 중입니다. 관리자 승인 후 이용 가능합니다.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const validation = bulkUpdateSiteSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { customerIds, site } = validation.data
    const targetSite = site.trim() || null // 빈 값이면 미지정(null)

    // 직원은 본인 소유 고객만, 관리자는 전체 — 다른 직원 DB 보호
    const baseWhere =
      session.user.role === 'ADMIN'
        ? { isDeleted: false }
        : { isDeleted: false, assignedUserId: session.user.id }

    let totalUpdated = 0
    for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
      const batch = customerIds.slice(i, i + BATCH_SIZE)
      const result = await prisma.customer.updateMany({
        where: { ...baseWhere, id: { in: batch } },
        data: { assignedSite: targetSite, updatedAt: new Date() },
      })
      totalUpdated += result.count
    }

    // 감사 로그
    await createAuditLog({
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'Customer',
      entityId: customerIds.length <= 10 ? customerIds.join(',') : `${customerIds.length}건 현장이동`,
      changes: { action: 'bulk_update_site', site: targetSite, count: totalUpdated },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    const skipped = customerIds.length - totalUpdated
    return NextResponse.json({
      success: true,
      count: totalUpdated,
      message:
        `${totalUpdated.toLocaleString()}명을 "${targetSite || '미지정'}" 현장으로 이동했습니다.` +
        (skipped > 0 ? ` (${skipped}명은 권한이 없어 제외됨)` : ''),
    })
  } catch (error) {
    console.error('Failed to bulk update site:', error)
    return NextResponse.json(
      { success: false, error: '현장 이동에 실패했습니다.' },
      { status: 500 }
    )
  }
}
