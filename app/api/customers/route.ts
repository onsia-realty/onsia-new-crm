import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createCustomerSchema, searchCustomerSchema } from '@/lib/validations/customer'
import { normalizePhone } from '@/lib/utils/phone'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

// GET /api/customers - 고객 목록 조회
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const query = searchParams.get('query') || undefined
    const assignedUserId = searchParams.get('assignedUserId') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where = {
      ...(query && {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { phone: { contains: normalizePhone(query) } },
          { email: { contains: query, mode: 'insensitive' as const } },
        ],
      }),
      ...(assignedUserId && { assignedUserId }),
      ...(session.user.role === 'EMPLOYEE' && { assignedUserId: session.user.id }),
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedUser: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              interestCards: true,
              visitSchedules: true,
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Failed to fetch customers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

// POST /api/customers - 고객 생성
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    console.log('Received body:', JSON.stringify(body, null, 2))

    const validatedData = createCustomerSchema.parse(body)
    console.log('Validated data:', JSON.stringify(validatedData, null, 2))
    
    const normalizedPhone = normalizePhone(validatedData.phone)

    // 중복 체크 (경고만 반환, 등록은 허용)
    const existingCustomers = await prisma.customer.findMany({
      where: {
        phone: normalizedPhone,
        isDeleted: false
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
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const customer = await prisma.customer.create({
      data: {
        ...validatedData,
        phone: normalizedPhone,
        assignedUserId: validatedData.assignedUserId || session.user.id,
        assignedAt: validatedData.assignedUserId ? new Date() : null,
      },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // 감사 로그
    await createAuditLog({
      userId: session.user.id,
      action: 'CREATE',
      entity: 'Customer',
      entityId: customer.id,
      changes: customer,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({
      success: true,
      data: customer,
      duplicateWarning: existingCustomers.length > 0 ? {
        exists: true,
        count: existingCustomers.length,
        customers: existingCustomers,
        message: `동일한 전화번호(${normalizedPhone})의 고객 ${existingCustomers.length}명이 존재합니다.`
      } : null
    })
  } catch (error) {
    console.error('Failed to create customer:', error)

    // Zod validation error
    if (error instanceof Error && error.name === 'ZodError') {
      const zodError = error as { errors?: Array<{ path: string[]; message: string }> }
      const errors = zodError.errors || []
      const errorMessages = errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      console.error('Validation errors:', errorMessages)
      return NextResponse.json(
        {
          success: false,
          error: `입력값 검증 실패: ${errorMessages}`,
          details: errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create customer' },
      { status: 500 }
    )
  }
}