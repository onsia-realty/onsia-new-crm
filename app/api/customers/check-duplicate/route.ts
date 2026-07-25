import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/utils/phone'

// GET /api/customers/check-duplicate - 전화번호 중복 체크
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json(
        { success: false, error: '전화번호를 입력해주세요' },
        { status: 400 }
      )
    }

    const normalizedPhone = normalizePhone(phone)

    // 전화번호가 같은 모든 고객 조회 (중복 허용 후)
    const existingCustomers = await prisma.customer.findMany({
      where: {
        phone: normalizedPhone,
        isDeleted: false // 삭제되지 않은 고객만
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        isBlind: true, // 블라인드DB 고객 판별용
        assignedUser: {
          select: {
            id: true,
            name: true,
            role: true,
            teamId: true
          },
        },
      },
      orderBy: {
        createdAt: 'desc' // 최신순
      }
    })

    // 블라인드DB 고객은 전화번호만 공개한다. 블라인드 목록의 번호를 이 API에 넣어
    // 이름·원 담당자 실명을 직행 조회하면 마스킹이 무의미해지므로,
    // name/email/createdAt/assignedUser는 null이 아니라 키 자체를 제거한다.
    const maskedCustomers = existingCustomers.map((c) =>
      c.isBlind ? { id: c.id, phone: c.phone, isBlind: true } : c
    )

    if (maskedCustomers.length > 0) {
      return NextResponse.json({
        success: true,
        exists: true,
        count: maskedCustomers.length, // 블라인드 행도 포함 — "이미 등록된 번호"는 중복 방지에 필요
        customers: maskedCustomers, // 배열로 반환
      })
    }

    return NextResponse.json({
      success: true,
      exists: false,
      count: 0,
      customers: []
    })
  } catch (error) {
    console.error('Failed to check duplicate:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check duplicate' },
      { status: 500 }
    )
  }
}
