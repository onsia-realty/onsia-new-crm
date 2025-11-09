import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createCustomerSchema } from '@/lib/validations/customer'
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
    // userId와 assignedUserId 둘 다 지원
    const userId = searchParams.get('userId') || searchParams.get('assignedUserId') || undefined
    const viewAll = searchParams.get('viewAll') === 'true' // 전체 보기 옵션
    const site = searchParams.get('site') // 현장 필터
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
      ...(userId && { assignedUserId: userId }),
      // 직원이 viewAll=true이면 전체 보기, 아니면 자기 고객만
      ...(session.user.role === 'EMPLOYEE' && !userId && !viewAll && { assignedUserId: session.user.id }),
      // 현장 필터
      ...(site && site !== '전체' && {
        assignedSite: site === 'null' ? null : site
      }),
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedUser: {
            select: { id: true, name: true, email: true, role: true },
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

    // 중복 전화번호 체크 (전체 DB에서 중복 검사)
    const duplicatePhones = await prisma.customer.groupBy({
      by: ['phone'],
      where: {
        isDeleted: false
      },
      _count: {
        phone: true
      },
      having: {
        phone: {
          _count: {
            gt: 1
          }
        }
      }
    })

    const duplicatePhoneSet = new Set(duplicatePhones.map(dp => dp.phone))

    // 중복 여부 추가
    const customersWithDuplicateFlag = customers.map(customer => ({
      ...customer,
      isDuplicate: duplicatePhoneSet.has(customer.phone)
    }))

    return NextResponse.json({
      success: true,
      data: customersWithDuplicateFlag,
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

    // Zod 검증
    const validation = createCustomerSchema.safeParse(body)
    if (!validation.success) {
      const errorMessages = validation.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ')
      console.error('Validation errors:', validation.error.issues)
      return NextResponse.json(
        {
          success: false,
          error: `입력값 검증 실패: ${errorMessages}`,
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const validatedData = validation.data
    console.log('Validated data:', JSON.stringify(validatedData, null, 2))

    const normalizedPhone = normalizePhone(validatedData.phone)

    // name이 없으면 자동 생성
    const customerName = validatedData.name && validatedData.name.trim()
      ? validatedData.name.trim()
      : `고객_${normalizedPhone.slice(-4)}`

    // 일일 등록 제한 확인 (관리자는 제외)
    const DAILY_LIMIT = 50;
    let canRegister = true;

    if (session.user.role !== 'ADMIN') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 오늘 승인 받은 횟수 확인
      const approvalCount = await prisma.dailyLimitApproval.count({
        where: {
          userId: session.user.id,
          date: today,
        },
      });

      // 현재 제한: 기본 50 + (승인 횟수 × 50)
      const currentLimit = DAILY_LIMIT + (approvalCount * DAILY_LIMIT);

      // 오늘 등록한 고객 수
      const todayCount = await prisma.customer.count({
        where: {
          assignedUserId: session.user.id,
          createdAt: {
            gte: today,
          },
        },
      });

      if (todayCount >= currentLimit) {
        canRegister = false;
      }
    }

    // 제한 초과 시 에러 반환
    if (!canRegister) {
      return NextResponse.json(
        {
          success: false,
          error: '일일 등록 제한을 초과했습니다. 관리자 승인이 필요합니다.',
          needsApproval: true,
        },
        { status: 403 }
      );
    }

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
        name: customerName,
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
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create customer' },
      { status: 500 }
    )
  }
}