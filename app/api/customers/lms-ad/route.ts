import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { maskPhonePartial, formatPhone } from '@/lib/utils/phone'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

const BATCH_PAGE = 500 // 차수(1차/2차) 단위
const LMS_SITE = 'LMS 수기DB' // LMS광고는 이 현장 고객만 등록 가능

const markSchema = z.object({
  customerIds: z.array(z.string()).min(1, '고객을 1명 이상 선택해주세요.'),
  action: z.enum(['add', 'remove']).default('add'),
})

// GET /api/customers/lms-ad
//  - 기본: LMS광고 수집 목록 (마스킹된 번호 + 담당자, lmsAdAt asc). 전 직원 열람
//  - ?export=1&batch=N : 해당 차수(N) 500개의 원본 전화번호 반환 (관리자 전용, 문자광고용)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const isExport = searchParams.get('export') === '1'

    if (isExport) {
      // 원본 번호 추출 — 관리자 전용
      if (session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: '관리자만 추출할 수 있습니다.' }, { status: 403 })
      }
      const batch = Math.max(1, parseInt(searchParams.get('batch') || '1', 10))
      const rows = await prisma.customer.findMany({
        where: { lmsAd: true, isDeleted: false },
        orderBy: { lmsAdAt: 'asc' },
        skip: (batch - 1) * BATCH_PAGE,
        take: BATCH_PAGE,
        select: {
          phone: true,
          assignedUser: { select: { name: true } },
        },
      })
      return NextResponse.json({
        success: true,
        batch,
        rows: rows.map((r) => ({
          phone: formatPhone(r.phone),
          assignee: r.assignedUser?.name || '미배분',
        })),
      })
    }

    // 목록 (마스킹) — 전 직원 열람
    const total = await prisma.customer.count({
      where: { lmsAd: true, isDeleted: false },
    })
    const rows = await prisma.customer.findMany({
      where: { lmsAd: true, isDeleted: false },
      orderBy: { lmsAdAt: 'asc' },
      select: {
        id: true,
        phone: true,
        lmsAdAt: true,
        assignedUser: { select: { name: true } },
      },
    })

    return NextResponse.json({
      success: true,
      total,
      batchSize: BATCH_PAGE,
      rows: rows.map((r) => ({
        id: r.id,
        phoneMasked: maskPhonePartial(r.phone), // 원본 미전송 — 직원 보호
        assignee: r.assignedUser?.name || '미배분',
        lmsAdAt: r.lmsAdAt,
      })),
    })
  } catch (error) {
    console.error('LMS-ad GET error:', error)
    return NextResponse.json({ success: false, error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}

// POST /api/customers/lms-ad — 선택 고객 LMS광고 풀에 올리기/내리기 (담당자 변경 없음)
// 직원: 본인 배분 고객만 / 관리자: 전체
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
    const validation = markSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { customerIds, action } = validation.data

    // 직원은 본인 소유 고객만, 관리자는 전체 — 다른 직원 DB 보호
    const ownerWhere =
      session.user.role === 'ADMIN'
        ? { isDeleted: false }
        : { isDeleted: false, assignedUserId: session.user.id }

    let totalUpdated = 0
    for (let i = 0; i < customerIds.length; i += BATCH_PAGE) {
      const slice = customerIds.slice(i, i + BATCH_PAGE)
      if (action === 'add') {
        // LMS광고는 'LMS 수기DB' 현장 고객만, 이미 올린 건(lmsAd=true)은 lmsAdAt 유지 위해 제외
        const result = await prisma.customer.updateMany({
          where: { ...ownerWhere, id: { in: slice }, lmsAd: false, assignedSite: LMS_SITE },
          data: { lmsAd: true, lmsAdAt: new Date(), lmsAdById: session.user.id },
        })
        totalUpdated += result.count
      } else {
        const result = await prisma.customer.updateMany({
          where: { ...ownerWhere, id: { in: slice }, lmsAd: true },
          data: { lmsAd: false, lmsAdAt: null, lmsAdById: null },
        })
        totalUpdated += result.count
      }
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'Customer',
      entityId: customerIds.length <= 10 ? customerIds.join(',') : `${customerIds.length}건 LMS광고`,
      changes: { action: `lms_ad_${action}`, count: totalUpdated },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    const skipped = customerIds.length - totalUpdated
    const verb = action === 'add' ? '올렸습니다' : '내렸습니다'
    return NextResponse.json({
      success: true,
      count: totalUpdated,
      message:
        `${totalUpdated.toLocaleString()}명을 LMS광고에 ${verb}.` +
        (skipped > 0
          ? action === 'add'
            ? ` (${skipped}명은 'LMS 수기DB' 현장이 아니거나 이미 등록됨/권한 없음으로 제외)`
            : ` (${skipped}명은 제외됨)`
          : ''),
    })
  } catch (error) {
    console.error('LMS-ad POST error:', error)
    return NextResponse.json({ success: false, error: 'LMS광고 처리에 실패했습니다.' }, { status: 500 })
  }
}
