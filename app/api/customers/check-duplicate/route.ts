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

    const existingCustomer = await prisma.customer.findUnique({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        assignedUser: {
          select: { id: true, name: true },
        },
      },
    })

    if (existingCustomer) {
      return NextResponse.json({
        success: true,
        exists: true,
        customer: existingCustomer,
      })
    }

    return NextResponse.json({
      success: true,
      exists: false,
    })
  } catch (error) {
    console.error('Failed to check duplicate:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check duplicate' },
      { status: 500 }
    )
  }
}
