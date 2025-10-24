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

    if (existingCustomers.length > 0) {
      return NextResponse.json({
        success: true,
        exists: true,
        count: existingCustomers.length,
        customers: existingCustomers, // 배열로 반환
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
