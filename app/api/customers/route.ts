import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
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
    const query = searchParams.get('query') || undefined // 전화번호 검색
    const nameQuery = searchParams.get('name') || undefined // 이름 검색 (별도)
    // userId와 assignedUserId 둘 다 지원
    const userId = searchParams.get('userId') || searchParams.get('assignedUserId') || undefined
    const viewAll = searchParams.get('viewAll') === 'true' // 전체 보기 옵션
    const site = searchParams.get('site') // 현장 필터
    const callFilter = searchParams.get('callFilter') // 통화 여부 필터: 'all', 'called', 'not_called'
    const dateFilter = searchParams.get('date') // 날짜 필터 (YYYY-MM-DD)
    const showDuplicatesOnly = searchParams.get('showDuplicatesOnly') === 'true' // 중복만 보기
    const excludeDuplicates = searchParams.get('excludeDuplicates') === 'true' // 중복 제외 보기
    const showAbsenceOnly = searchParams.get('showAbsenceOnly') === 'true' // 부재 기록이 있는 고객만 보기
    const isPublicFilter = searchParams.get('isPublic') // 공개DB 필터
    const idsOnly = searchParams.get('idsOnly') === 'true' // ID만 반환 (네비게이션용 경량 모드)
    const page = parseInt(searchParams.get('page') || '1')
    const limitParam = searchParams.get('limit')
    // limit=0이면 무제한, 그렇지 않으면 지정값 또는 기본값 20
    const limit = limitParam === '0' ? 0 : parseInt(limitParam || '20')

    // 공개DB 모드 여부
    const isPublicMode = isPublicFilter === 'true'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isDeleted: false, // 삭제된 고객 제외
      // 공개DB 필터: isPublic=true면 공개 고객만, 그렇지 않으면 비공개 고객만
      isPublic: isPublicMode,
      // 전화번호 검색 (기존 query 파라미터)
      ...(query && {
        phone: { contains: query.replace(/[^0-9]/g, '') },
      }),
      // 이름 검색 (별도 name 파라미터)
      ...(nameQuery && {
        name: { contains: nameQuery, mode: 'insensitive' as const },
      }),
      // 공개DB 모드에서는 assignedUserId 필터 무시
      ...(!isPublicMode && userId && { assignedUserId: userId }),
      // 직원이 viewAll=true이면 전체 보기, 아니면 자기 고객만 (공개DB 모드에서는 무시)
      ...(!isPublicMode && session.user.role === 'EMPLOYEE' && !userId && !viewAll && { assignedUserId: session.user.id }),
      // 현장 필터
      ...(site && site !== '전체' && site !== 'all' && {
        assignedSite: site === 'null' ? null : site
      }),
      // 날짜 필터 (특정 날짜에 등록된 고객만)
      ...(dateFilter && {
        createdAt: {
          gte: new Date(dateFilter + 'T00:00:00.000Z'),
          lt: new Date(dateFilter + 'T23:59:59.999Z')
        }
      }),
    }

    // 통화 여부 필터
    if (callFilter === 'called') {
      // 통화 기록이 있거나 메모가 있는 고객
      where.OR = [
        ...(where.OR || []),
        { callLogs: { some: {} } },
        { AND: [{ memo: { not: null } }, { memo: { not: '' } }] }
      ]
    } else if (callFilter === 'not_called') {
      // 통화 기록도 없고 메모도 없는 고객
      where.AND = [
        ...(where.AND || []),
        { callLogs: { none: {} } },
        { OR: [{ memo: null }, { memo: '' }] }
      ]
    }

    // 부재 고객만 필터 (마지막 통화가 부재인 고객)
    // 이 필터는 별도 처리가 필요하므로 여기서는 플래그만 설정
    // 실제 필터링은 아래에서 수행

    // 정렬 기준: displayOrder ASC (엑셀 순서) → 직원별 조회 시 assignedAt → createdAt
    // displayOrder가 null인 고객은 createdAt DESC로 정렬됨 (NULLS LAST)
    const orderBy = userId
      ? [
          { displayOrder: 'asc' as const },
          { assignedAt: 'desc' as const },
          { createdAt: 'desc' as const }
        ]
      : [
          { displayOrder: 'asc' as const },
          { createdAt: 'desc' as const }
        ];

    // idsOnly 모드: ID만 반환 (네비게이션용 경량 모드)
    if (idsOnly) {
      // 부재 고객만 보기 필터 (마지막 통화가 부재인 고객)
      if (showAbsenceOnly) {
        // 권한 기반 필터링: 직원은 자기 고객만, userId 지정 시 해당 직원, viewAll 시 전체
        const targetUserId = userId ||
          (session.user.role === 'EMPLOYEE' && !viewAll ? session.user.id : null);

        // 마지막 통화가 부재인 고객 ID 조회 (Raw SQL)
        const absenceCustomerIds = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT c.id
          FROM "Customer" c
          INNER JOIN (
            SELECT "customerId", MAX("createdAt") as "lastCallAt"
            FROM "CallLog"
            GROUP BY "customerId"
          ) latest ON c.id = latest."customerId"
          INNER JOIN "CallLog" cl ON cl."customerId" = c.id AND cl."createdAt" = latest."lastCallAt"
          WHERE c."isDeleted" = false
          AND cl.content LIKE '%부재%'
          ${targetUserId ? Prisma.sql`AND c."assignedUserId" = ${targetUserId}` : Prisma.empty}
          ORDER BY c."displayOrder" ASC NULLS LAST, c."createdAt" DESC
        `;

        return NextResponse.json({
          success: true,
          ids: absenceCustomerIds.map(c => c.id),
          total: absenceCustomerIds.length,
        });
      }

      // 중복만 보기 필터가 있을 경우, 중복 전화번호를 먼저 찾아야 함
      if (showDuplicatesOnly) {
        // 중복된 전화번호 찾기
        const duplicatePhones = await prisma.customer.groupBy({
          by: ['phone'],
          where: { isDeleted: false },
          _count: { phone: true },
          having: {
            phone: { _count: { gt: 1 } }
          }
        });

        const duplicatePhoneSet = new Set(duplicatePhones.map(dp => dp.phone));

        // 중복 전화번호를 가진 고객만 필터링
        const allCustomerIds = await prisma.customer.findMany({
          where: {
            ...where,
            phone: { in: Array.from(duplicatePhoneSet) }
          },
          orderBy,
          select: { id: true },
        });

        return NextResponse.json({
          success: true,
          ids: allCustomerIds.map(c => c.id),
          total: allCustomerIds.length,
        });
      }

      // 중복+블랙리스트 제외 필터
      if (excludeDuplicates) {
        const excludePhones = new Set<string>()

        const dupPhones = await prisma.customer.groupBy({
          by: ['phone'],
          where: { isDeleted: false },
          _count: { phone: true },
          having: { phone: { _count: { gt: 1 } } },
        })
        dupPhones.forEach(dp => excludePhones.add(dp.phone))

        const blacklistPhones = await prisma.blacklist.findMany({
          where: { isActive: true },
          select: { phone: true },
        })
        blacklistPhones.forEach(b => excludePhones.add(b.phone))

        const allCustomerIds = await prisma.customer.findMany({
          where,
          orderBy,
          select: { id: true, phone: true },
        })

        const filtered = allCustomerIds.filter(c => !excludePhones.has(c.phone))
        return NextResponse.json({
          success: true,
          ids: filtered.map(c => c.id),
          total: filtered.length,
        })
      }

      const allCustomerIds = await prisma.customer.findMany({
        where,
        orderBy,
        select: { id: true },
      });

      return NextResponse.json({
        success: true,
        ids: allCustomerIds.map(c => c.id),
        total: allCustomerIds.length,
      });
    }

    // 부재 고객만 보기 필터 (마지막 통화가 부재인 고객)
    let customers;
    let total;

    if (showAbsenceOnly) {
      // 권한 기반 필터링: 직원은 자기 고객만, userId 지정 시 해당 직원, viewAll 시 전체
      const targetUserId = userId ||
        (session.user.role === 'EMPLOYEE' && !viewAll ? session.user.id : null);

      // 마지막 통화가 부재인 고객 ID 조회 (Raw SQL)
      const absenceCustomerIds = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT c.id
        FROM "Customer" c
        INNER JOIN (
          SELECT "customerId", MAX("createdAt") as "lastCallAt"
          FROM "CallLog"
          GROUP BY "customerId"
        ) latest ON c.id = latest."customerId"
        INNER JOIN "CallLog" cl ON cl."customerId" = c.id AND cl."createdAt" = latest."lastCallAt"
        WHERE c."isDeleted" = false
        AND cl.content LIKE '%부재%'
        ${targetUserId ? Prisma.sql`AND c."assignedUserId" = ${targetUserId}` : Prisma.empty}
        ORDER BY c."displayOrder" ASC NULLS LAST, c."createdAt" DESC
      `;

      const absenceIds = absenceCustomerIds.map(c => c.id);
      total = absenceIds.length;

      // 페이지네이션 적용하여 고객 조회
      const paginatedIds = limit > 0
        ? absenceIds.slice((page - 1) * limit, page * limit)
        : absenceIds;

      customers = paginatedIds.length > 0
        ? await prisma.customer.findMany({
            where: { id: { in: paginatedIds } },
            orderBy,
            include: {
              assignedUser: {
                select: { id: true, name: true, email: true, role: true },
              },
              _count: {
                select: {
                  interestCards: true,
                  visitSchedules: true,
                  callLogs: true,
                },
              },
            },
          })
        : [];

      // ID 순서대로 정렬 유지
      const idOrderMap = new Map(paginatedIds.map((id, index) => [id, index]));
      customers.sort((a, b) => (idOrderMap.get(a.id) || 0) - (idOrderMap.get(b.id) || 0));
    } else {
      // 중복+블랙리스트 제외 필터
      const effectiveWhere = { ...where }
      if (excludeDuplicates) {
        const excludePhones = new Set<string>()

        // 중복 전화번호 수집
        const dupPhones = await prisma.customer.groupBy({
          by: ['phone'],
          where: { isDeleted: false },
          _count: { phone: true },
          having: { phone: { _count: { gt: 1 } } },
        })
        dupPhones.forEach(dp => excludePhones.add(dp.phone))

        // 블랙리스트 전화번호 수집
        const blacklistPhones = await prisma.blacklist.findMany({
          where: { isActive: true },
          select: { phone: true },
        })
        blacklistPhones.forEach(b => excludePhones.add(b.phone))

        if (excludePhones.size > 0) {
          effectiveWhere.phone = { notIn: Array.from(excludePhones) }
        }
      }

      // 기존 로직
      [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where: effectiveWhere,
          ...(limit > 0 ? { skip: (page - 1) * limit, take: limit } : {}), // limit=0이면 페이징 없이 전체 조회
          orderBy,
          include: {
            assignedUser: {
              select: { id: true, name: true, email: true, role: true },
            },
            _count: {
              select: {
                interestCards: true,
                visitSchedules: true,
                callLogs: true,
              },
            },
          },
        }),
        prisma.customer.count({ where: effectiveWhere }),
      ]);
    }

    // 중복 전화번호 체크를 현재 페이지 고객들의 전화번호로만 제한
    const currentPagePhones = customers.map(c => c.phone);
    const duplicatePhones = currentPagePhones.length > 0
      ? await prisma.customer.groupBy({
          by: ['phone'],
          where: {
            phone: { in: currentPagePhones },
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
      : [];

    const duplicatePhoneSet = new Set(duplicatePhones.map(dp => dp.phone))

    // 중복된 전화번호를 가진 모든 고객 정보 조회
    const duplicateCustomers = duplicatePhoneSet.size > 0
      ? await prisma.customer.findMany({
          where: {
            phone: { in: Array.from(duplicatePhoneSet) },
            isDeleted: false
          },
          select: {
            id: true,
            name: true,
            phone: true,
            assignedUser: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        })
      : [];

    // 전화번호별로 중복 고객 그룹화
    const duplicateMap = new Map<string, typeof duplicateCustomers>();
    duplicateCustomers.forEach(customer => {
      if (!duplicateMap.has(customer.phone)) {
        duplicateMap.set(customer.phone, []);
      }
      duplicateMap.get(customer.phone)!.push(customer);
    });

    // 블랙리스트 체크 (현재 페이지 고객들의 전화번호로)
    const blacklistEntries = currentPagePhones.length > 0
      ? await prisma.blacklist.findMany({
          where: {
            phone: { in: currentPagePhones },
            isActive: true,
          },
          select: {
            phone: true,
            reason: true,
            registeredBy: {
              select: { name: true },
            },
          },
        })
      : [];

    // 블랙리스트 전화번호 Set 생성
    const blacklistMap = new Map(blacklistEntries.map(b => [b.phone, b]));

    // 중복 여부, 블랙리스트 여부 추가
    const customersWithFlags = customers.map(customer => {
      const duplicates = duplicateMap.get(customer.phone) || [];
      // 자기 자신을 제외한 중복 고객들
      const otherDuplicates = duplicates.filter(d => d.id !== customer.id);
      const blacklistInfo = blacklistMap.get(customer.phone);

      return {
        ...customer,
        isDuplicate: duplicatePhoneSet.has(customer.phone),
        duplicateWith: otherDuplicates.length > 0 ? otherDuplicates : undefined,
        isBlacklisted: !!blacklistInfo,
        blacklistInfo: blacklistInfo || undefined,
      };
    })

    return NextResponse.json({
      success: true,
      data: customersWithFlags,
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