import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 예약방문 보드 — 직원/관리자 공용 일자별 보드
// GET  /api/visit-board?date=YYYY-MM-DD   → 해당 일자의 전 직원 + 방문 목록
// POST /api/visit-board                   → 본인(또는 관리자가 assigneeId 지정) 방문 추가

type BoardRole = 'EMPLOYEE' | 'TEAM_LEADER' | 'HEAD' | 'ADMIN' | 'CEO'

const ADMIN_ROLES: BoardRole[] = ['HEAD', 'ADMIN', 'CEO']
// 예약방문 보드 행으로 노출할 role (관리자/대표는 행에서 제외, 단 본인 권한으로는 여전히 열람 가능)
const BOARD_VISIBLE_ROLES: BoardRole[] = ['EMPLOYEE', 'TEAM_LEADER']
// 보드에서 숨길 사용자 이름 (테스트 계정/비활성 직원). 추후 User 모델에 flag 추가 시 대체.
const HIDDEN_USER_NAMES = ['남은희', '테스트 11', '관리자', '김수경', '연대겸']

function parseBoardDate(dateStr: string | null): { startUtc: Date; endUtc: Date; dateKey: string } | null {
  if (!dateStr) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return null
  const [, y, mo, d] = m
  // KST 자정 ~ 다음날 자정 (UTC로 환산해 저장된 데이터 조회)
  const kstStart = new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0, 0)
  const startUtc = new Date(kstStart.getTime() - 9 * 60 * 60 * 1000)
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)
  return { startUtc, endUtc, dateKey: dateStr }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dateStr = req.nextUrl.searchParams.get('date')
    const range = parseBoardDate(dateStr)
    if (!range) {
      return NextResponse.json(
        { error: 'date 파라미터(YYYY-MM-DD)가 필요합니다.' },
        { status: 400 },
      )
    }

    // 보드 노출 대상: 활성 EMPLOYEE/TEAM_LEADER + 숨김 이름 제외
    const users = await prisma.user.findMany({
      where: {
        role: { in: BOARD_VISIBLE_ROLES },
        isActive: true,
        name: { notIn: HIDDEN_USER_NAMES },
      },
      select: { id: true, name: true, position: true, role: true, teamId: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })

    const visits = await prisma.visitSchedule.findMany({
      where: {
        visitDate: { gte: range.startUtc, lt: range.endUtc },
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, assignedSite: true },
        },
        user: { select: { id: true, name: true, position: true } },
      },
      orderBy: { visitDate: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        date: range.dateKey,
        users,
        visits,
      },
    })
  } catch (error) {
    console.error('Failed to load visit board:', error)
    return NextResponse.json(
      { success: false, error: '예약방문 보드를 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      customerId,
      visitDate, // "YYYY-MM-DDTHH:mm" (KST), 또는 null이면 "시간 미정"
      visitDateOnly, // "YYYY-MM-DD" — 시간 미정용
      assigneeId,
      location,
      visitType,
      memo,
    } = body as {
      customerId?: string
      visitDate?: string | null
      visitDateOnly?: string | null
      assigneeId?: string
      location?: string
      visitType?: string
      memo?: string
    }

    if (!customerId) {
      return NextResponse.json({ error: '고객을 선택해주세요.' }, { status: 400 })
    }

    // 본인 외 사용자 지정은 관리자만
    const isAdmin = ADMIN_ROLES.includes(session.user.role as BoardRole)
    const targetUserId = assigneeId && assigneeId !== session.user.id ? assigneeId : session.user.id
    if (targetUserId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: '다른 담당자 지정 권한이 없습니다.' }, { status: 403 })
    }

    let utcDate: Date
    if (visitDate) {
      const [datePart, timePart] = visitDate.split('T')
      const [y, mo, d] = datePart.split('-').map(Number)
      const [hh, mm] = (timePart || '00:00').split(':').map(Number)
      const kst = new Date(y, mo - 1, d, hh, mm, 0, 0)
      utcDate = new Date(kst.getTime() - 9 * 60 * 60 * 1000)
    } else if (visitDateOnly) {
      // 시간 미정 → 해당일 KST 00:00을 일단 저장하고 memo에 "시간 미정" 표시
      const [y, mo, d] = visitDateOnly.split('-').map(Number)
      const kst = new Date(y, mo - 1, d, 0, 0, 0, 0)
      utcDate = new Date(kst.getTime() - 9 * 60 * 60 * 1000)
    } else {
      return NextResponse.json(
        { error: '방문 일자 또는 시각이 필요합니다.' },
        { status: 400 },
      )
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, assignedSite: true },
    })
    if (!customer) {
      return NextResponse.json({ error: '존재하지 않는 고객입니다.' }, { status: 404 })
    }

    const composedMemo = !visitDate && visitDateOnly
      ? `[시간 미정]${memo ? ` ${memo}` : ''}`
      : memo || null

    const created = await prisma.visitSchedule.create({
      data: {
        customerId,
        userId: targetUserId,
        visitDate: utcDate,
        visitType: (visitType as 'PROPERTY_VIEWING' | 'CONTRACT_MEETING' | 'CONSULTATION' | 'OTHER') || 'PROPERTY_VIEWING',
        location: location || customer.assignedSite || '온시아',
        status: 'SCHEDULED',
        memo: composedMemo,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, assignedSite: true } },
        user: { select: { id: true, name: true, position: true } },
      },
    })

    return NextResponse.json({ success: true, data: created })
  } catch (error) {
    console.error('Failed to create visit on board:', error)
    return NextResponse.json(
      { success: false, error: '방문 추가에 실패했습니다.' },
      { status: 500 },
    )
  }
}
