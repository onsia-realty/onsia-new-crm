import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createCustomerSchema } from '@/lib/validations/customer'
import { normalizePhone } from '@/lib/utils/phone'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'
import { getBlindDbState } from '@/lib/blind-db/config'
import { excludeOwnBlindEntries, maskBlindCustomerList } from '@/lib/blind-db/mask'

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
    const memoSearch = searchParams.get('memo') || undefined // 메모/통화내용 검색
    // userId와 assignedUserId 둘 다 지원
    const userId = searchParams.get('userId') || searchParams.get('assignedUserId') || undefined
    const viewAll = searchParams.get('viewAll') === 'true' // 전체 보기 옵션
    const site = searchParams.get('site') // 현장 필터
    const callFilter = searchParams.get('callFilter') // 통화 여부 필터: 'all', 'called', 'not_called'
    const dateFilter = searchParams.get('date') // 날짜 필터 (YYYY-MM-DD)
    const showDuplicatesOnly = searchParams.get('showDuplicatesOnly') === 'true' // 중복만 보기
    const excludeDuplicates = searchParams.get('excludeDuplicates') === 'true' // 중복 제외 보기
    const showAbsenceOnly = searchParams.get('showAbsenceOnly') === 'true' // 부재 기록이 있는 고객만 보기
    const materialSentOnly = searchParams.get('materialSent') === 'true' // 자료 발송된 고객만 보기
    const isPublicFilter = searchParams.get('isPublic') // 공개DB 필터
    const isBlindFilter = searchParams.get('isBlind') // 블라인드DB 필터
    const sourceFilter = searchParams.get('source') // 출처 필터 (AD/TM/WALKING/CAR_ORDER/FIELD)
    const shuffleSeed = searchParams.get('shuffle') // 공개DB 랜덤 섞기 (시드 값 — 같은 시드면 같은 순서)
    const sortBy = searchParams.get('sort') // 정렬 기준: 'updatedAt' = 최신 작성일순 (그 외/없음 = 기본 정렬)
    const idsOnly = searchParams.get('idsOnly') === 'true' // ID만 반환 (네비게이션용 경량 모드)
    const countOnly = searchParams.get('countOnly') === 'true' // 총 건수만 반환 (정렬/목록/allIds 생략 — 카운트 위젯용)
    const page = parseInt(searchParams.get('page') || '1')
    const limitParam = searchParams.get('limit')
    // limit=0이면 무제한, 그렇지 않으면 지정값 또는 기본값 20
    const limit = limitParam === '0' ? 0 : parseInt(limitParam || '20')

    // 공개DB 모드 여부
    const isPublicMode = isPublicFilter === 'true'
    // 블라인드DB 모드 여부
    const isBlindMode = isBlindFilter === 'true'
    const isBlindAdmin = ['ADMIN', 'CEO'].includes(session.user.role)

    // 공개DB와 블라인드DB는 상호배타 — 둘 다 true인 조회는 의미가 없고,
    // 조건 조합 실수를 조용히 빈 결과로 삼키면 안 되므로 명시적으로 거절한다
    if (isBlindMode && isPublicMode) {
      return NextResponse.json(
        { success: false, error: '공개DB와 블라인드DB는 동시에 조회할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 블라인드DB 오픈 게이트 — 오픈 전에는 관리자만 미리보기 가능
    // (오픈 시 고정 저장된 셔플 시드도 여기서 함께 읽어 아래 정렬에 사용한다)
    let blindStoredSeed: string | null = null
    if (isBlindMode) {
      const blindState = await getBlindDbState()
      blindStoredSeed = blindState.shuffleSeed
      if (!blindState.open && !isBlindAdmin) {
        const closedMessage = '블라인드DB가 아직 오픈되지 않았습니다. 관리자가 오픈하면 조회할 수 있습니다.'
        if (idsOnly) {
          return NextResponse.json({
            success: true,
            ids: [],
            total: 0,
            blindDbClosed: true,
            message: closedMessage,
          })
        }
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          blindDbClosed: true,
          message: closedMessage,
        })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isDeleted: false, // 삭제된 고객 제외
      // 공개DB 필터: isPublic=true면 공개 고객만, 그렇지 않으면 비공개 고객만
      isPublic: isPublicMode,
      // 블라인드DB 필터: isBlind=true면 블라인드 고객만, 그렇지 않으면 블라인드 고객 제외
      isBlind: isBlindMode,
      // 전화번호 검색 (기존 query 파라미터)
      ...(query && {
        phone: { contains: query.replace(/[^0-9]/g, '') },
      }),
      // 이름 검색 (별도 name 파라미터)
      // 블라인드DB 모드에서는 무시 — 히트 여부로 가려진 이름을 역추론하는 오라클이 된다
      ...(!isBlindMode && nameQuery && {
        name: { contains: nameQuery, mode: 'insensitive' as const },
      }),
      // 메모/통화내용 검색: Customer.memo 또는 CallLog.content에서 검색
      // callFilter의 OR/AND와 충돌 방지를 위해 AND 안에 별도 OR 그룹으로 감싸기
      // 블라인드DB 모드에서는 무시 — 가려진 메모/통화내용을 역추론할 수 있다
      ...(!isBlindMode && memoSearch && {
        AND: [
          {
            OR: [
              { memo: { contains: memoSearch, mode: 'insensitive' as const } },
              { callLogs: { some: { content: { contains: memoSearch, mode: 'insensitive' as const } } } },
            ],
          },
        ],
      }),
      // 공개DB/블라인드DB 모드에서는 assignedUserId 필터 무시 (블라인드는 assignedUserId가 null)
      ...(!isPublicMode && !isBlindMode && userId && { assignedUserId: userId }),
      // 직원이 viewAll=true이면 전체 보기, 아니면 자기 고객만 (공개DB/블라인드DB 모드에서는 무시)
      ...(!isPublicMode && !isBlindMode && session.user.role === 'EMPLOYEE' && !userId && !viewAll && { assignedUserId: session.user.id }),
      // 현장 필터 (블라인드DB 모드에서는 무시 — 필터가 먹으면 assignedSite를 노출한 것과 같다)
      ...(!isBlindMode && site && site !== '전체' && site !== 'all' && {
        assignedSite: site === 'null' ? null : site
      }),
      // 출처 필터 (광고콜 고객: source=AD) — 블라인드DB 모드에서는 무시
      ...(!isBlindMode && sourceFilter && {
        source: sourceFilter as 'AD' | 'TM' | 'WALKING' | 'CAR_ORDER' | 'FIELD'
      }),
      // 자료 발송 필터 (자료받은 고객 모드) — 블라인드DB 모드에서는 무시
      ...(!isBlindMode && materialSentOnly && { materialSent: true }),
      // 날짜 필터 (특정 날짜에 등록된 고객만) — 블라인드DB 모드에서는 무시
      ...(!isBlindMode && dateFilter && {
        createdAt: {
          gte: new Date(dateFilter + 'T00:00:00.000Z'),
          lt: new Date(dateFilter + 'T23:59:59.999Z')
        }
      }),
    }

    // 통화 여부 필터 (블라인드DB 모드에서는 무시 — memo/통화기록 존재 여부가 곧 손 탄 정도다)
    if (!isBlindMode && callFilter === 'called') {
      // 통화 기록이 있거나 메모가 있는 고객
      where.OR = [
        ...(where.OR || []),
        { callLogs: { some: {} } },
        { AND: [{ memo: { not: null } }, { memo: { not: '' } }] }
      ]
    } else if (!isBlindMode && callFilter === 'not_called') {
      // 통화 기록도 없고 메모도 없는 고객
      where.AND = [
        ...(where.AND || []),
        { callLogs: { none: {} } },
        { OR: [{ memo: null }, { memo: '' }] }
      ]
    }

    // 공개DB/블라인드DB 모드: 블랙리스트 등록 고객(전화금지) 제외
    // → 블랙리스트에 등록되면 목록/네비게이션/카운트에서 모두 제외됨
    //   (직원 본인 DB에서는 경고와 함께 계속 노출되어야 하므로 공개/블라인드DB에만 적용)
    if (isPublicMode || isBlindMode) {
      const blacklistedPhones = await prisma.blacklist.findMany({
        where: { isActive: true },
        select: { phone: true },
      })
      if (blacklistedPhones.length > 0) {
        const phones = blacklistedPhones.map((b) => b.phone)
        where.phone =
          where.phone && typeof where.phone === 'object'
            ? { ...where.phone, notIn: phones }
            : { notIn: phones }
      }
    }

    // 블라인드DB 모드: 원 소유자가 올린 건은 목록에서 아예 제외
    // → 이전 기록을 아는 사람이 좋은 번호만 골라 회수하는 것을 원천 차단
    // ⚠ excludeOwnBlindEntries는 OR을 반환하므로 top-level에 spread하면 callFilter의
    //   where.OR과 충돌해 한쪽이 조용히 덮인다. 반드시 AND 배열에 넣는다.
    if (isBlindMode && !isBlindAdmin) {
      where.AND = [...(where.AND ?? []), excludeOwnBlindEntries(session.user.id)]
    }

    // 부재 고객만 필터 (마지막 통화가 부재인 고객)
    // 이 필터는 별도 처리가 필요하므로 여기서는 플래그만 설정
    // 실제 필터링은 아래에서 수행

    // countOnly 모드: 총 건수만 필요한 카운트 위젯용 경량 경로.
    //   공개DB 모드라도 무거운 전체 정렬/allIds 계산을 건너뛰고 count() 만 수행한다.
    //   (callFilter 카운트·공개DB 잔여수 위젯이 limit=1 로 호출하던 것을 대체)
    if (countOnly) {
      const total = await prisma.customer.count({ where })
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total,
          totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
        },
      })
    }

    // 정렬 기준:
    //   - sort=updatedAt 이면 '최신 작성일순'(updatedAt DESC) 우선 — 자료받은 고객 등에서 재통화 순서용
    //   - 자료받은 고객 모드 기본: materialSentAt DESC (방금 발송한 고객이 항상 맨 위)
    //     엑셀 순번(displayOrder)으로 정렬하면 방금 표시한 고객이 목록 중간에 묻혀
    //     "발송했는데 목록에 없다"고 오인하게 됨
    //   - 그 외 기본: displayOrder ASC (엑셀 순서) → 직원별 조회 시 assignedAt → createdAt
    //     displayOrder가 null인 고객은 createdAt DESC로 정렬됨 (NULLS LAST)
    //   - 블라인드DB 모드에서는 sort/materialSent/userId를 모두 무시하고 기본 정렬을 쓴다
    //     (실제 목록 순서는 아래 블라인드 전용 raw SQL 정렬이 결정)
    const orderBy = !isBlindMode && sortBy === 'updatedAt'
      ? [
          { updatedAt: 'desc' as const },
          { createdAt: 'desc' as const }
        ]
      : !isBlindMode && materialSentOnly
      ? [
          // 과거 데이터 중 materialSentAt이 비어 있는 건은 뒤로 (NULLS LAST)
          { materialSentAt: { sort: 'desc' as const, nulls: 'last' as const } },
          { updatedAt: 'desc' as const }
        ]
      : !isBlindMode && userId
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
      // 부재 고객만 보기 필터 (마지막 통화가 부재인 고객) — 블라인드DB 모드에서는 무시
      if (!isBlindMode && showAbsenceOnly) {
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
          AND c."isBlind" = false
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

      // 중복만 보기 필터가 있을 경우, 중복 전화번호를 먼저 찾아야 함 (블라인드DB 모드에서는 무시)
      if (!isBlindMode && showDuplicatesOnly) {
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

      // 중복+블랙리스트 제외 필터 (블라인드DB 모드에서는 무시)
      if (!isBlindMode && excludeDuplicates) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let customers: any[] = [];
    let total: number = 0;
    // 네비게이션용 전체 정렬 ID (공개DB/블라인드DB 모드에서 상세 페이지 이전/다음 탐색에 사용)
    let allIds: string[] | null = null;
    // 블라인드DB 마스킹에 함께 실을 파생값 (가려진 _count.callLogs 대체)
    const blindExtraById: Record<string, { visibleCallCount: number; hasAbsence: boolean }> = {};

    if (isBlindMode) {
      // 블라인드DB 정렬 — 공개DB 정렬(3-tier + 일자 + md5 랜덤)을 미러링하되 두 곳이 다르다:
      //   1) tier 계산이 blindAt 이후 로그만 본다 (LATERAL 안의 행별 cutoff)
      //      → 전체 로그로 계산하면 이전 담당자가 남긴 부재 때문에 tier 2로 밀려나고,
      //        그 순서 자체가 "손 많이 탄 번호"를 드러낸다
      //   2) 2순위 키가 publicAt 이 아니라 blindAt (블라인드 전환 일자)
      // 시드: shuffle 파라미터 > 오픈 시 고정 저장된 시드 > 폴백으로 오늘 날짜
      //   공개DB는 시드가 없으면 매일 순서가 바뀌지만, 블라인드DB는 "다 모아서 한 번
      //   섞는다"는 요구이므로 고정 시드를 우선한다.
      // LATERAL 하나로 정렬과 visibleCallCount를 동시에 얻으므로 _count 재계산이 필요 없다.
      const todaySeed = new Date().toISOString().slice(0, 10);
      const seed = shuffleSeed || blindStoredSeed || todaySeed;

      const filteredIds = await prisma.customer.findMany({
        where,
        select: { id: true },
      });
      const idList = filteredIds.map((c) => c.id);

      if (idList.length === 0) {
        customers = [];
        total = 0;
        allIds = [];
      } else {
        const orderedRows = await prisma.$queryRaw<
          Array<{ id: string; visibleCalls: number; hasAbsent: boolean }>
        >`
          SELECT c.id,
                 COALESCE(calls.visible, 0)::int AS "visibleCalls",
                 COALESCE(calls."hasAbsent", false) AS "hasAbsent"
          FROM "Customer" c
          LEFT JOIN LATERAL (
            SELECT count(*) AS visible,
                   bool_or(cl.content LIKE '%부재%') AS "hasAbsent"
            FROM "CallLog" cl
            WHERE cl."customerId" = c.id AND cl."createdAt" >= c."blindAt"
          ) calls ON true
          WHERE c.id = ANY(${idList})
          ${isBlindAdmin ? Prisma.empty : Prisma.sql`AND (c."blindById" IS NULL OR c."blindById" <> ${session.user.id})`}
          ORDER BY
            CASE
              WHEN calls."hasAbsent" THEN 2
              WHEN calls.visible > 0 THEN 1
              ELSE 0
            END ASC,
            DATE(c."blindAt") DESC NULLS LAST,
            md5(c.id || ${seed}) ASC
        `;
        total = orderedRows.length;
        // 정렬된 전체 ID — 상세 페이지 이전/다음 탐색용 (반드시 블라인드 where 기준이어야
        // "다음"을 눌렀을 때 비블라인드 고객이나 자기 등록건으로 넘어가지 않는다)
        allIds = orderedRows.map((r) => r.id);

        const paginatedRows =
          limit > 0 ? orderedRows.slice((page - 1) * limit, page * limit) : orderedRows;
        const paginatedOrderedIds = paginatedRows.map((r) => r.id);
        paginatedRows.forEach((r) => {
          blindExtraById[r.id] = { visibleCallCount: r.visibleCalls, hasAbsence: r.hasAbsent };
        });

        // select를 최소화하는 것이 1차 방어 — 마스킹 판정에 필요한 필드만 가져온다
        customers =
          paginatedOrderedIds.length > 0
            ? await prisma.customer.findMany({
                where: { id: { in: paginatedOrderedIds } },
                select: {
                  id: true,
                  phone: true,
                  isBlind: true,
                  blindAt: true,
                  blindById: true,
                  assignedUserId: true,
                },
              })
            : [];

        const orderMap = new Map(paginatedOrderedIds.map((id, i) => [id, i]));
        customers.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
      }
    } else if (showAbsenceOnly) {
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
        AND c."isBlind" = false
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
    } else if (isPublicMode) {
      // 공개DB 정렬 — 양질 우선 + tier + 일자별 그룹 랜덤
      //   1순위 Tier (업무 우선순위):
      //     Tier 0: 통화 기록 없는 '신규' 고객  → 먼저 노출
      //     Tier 1: 통화 기록 있으나 부재가 마지막이 아닌 고객
      //     Tier 2: 마지막 통화가 부재인 고객      → 맨 뒤로
      //   2순위 publicAt(공개 전환 일자) DESC NULLS LAST
      //     → 최근 업로드된 양질 DB가 먼저 노출됨 (예: 5/9 업로드분이 5/2 업로드분보다 먼저)
      //   3순위 md5(id || seed) 랜덤
      //     → 같은 일자 내에서는 랜덤으로 섞여서 직원 간 공정성 유지
      // 시드 전략:
      //   - shuffle 파라미터가 있으면 그 시드 사용 (수동 새로섞기)
      //   - 없으면 오늘 날짜(YYYY-MM-DD) 사용 → 하루 동안은 모든 직원이 같은 순서 (공정)
      const todaySeed = new Date().toISOString().slice(0, 10);
      const seed = shuffleSeed || todaySeed;

      const filteredIds = await prisma.customer.findMany({
        where,
        select: { id: true },
      });
      const idList = filteredIds.map((c) => c.id);

      if (idList.length === 0) {
        customers = [];
        total = 0;
      } else {
        // CallLog 를 한 번만 스캔하도록 두 서브쿼리를 하나로 병합 (성능 개선)
        //   hasAbsent  : '부재' 통화 기록이 하나라도 있으면 true
        //   customerId : 통화 기록이 하나라도 있으면 NOT NULL
        const orderedIds = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT c.id
          FROM "Customer" c
          LEFT JOIN (
            SELECT "customerId",
                   bool_or(content LIKE '%부재%') AS "hasAbsent"
            FROM "CallLog"
            GROUP BY "customerId"
          ) calls ON c.id = calls."customerId"
          WHERE c.id = ANY(${idList})
          ORDER BY
            CASE
              WHEN calls."hasAbsent" THEN 2
              WHEN calls."customerId" IS NOT NULL THEN 1
              ELSE 0
            END ASC,
            DATE(c."publicAt") DESC NULLS LAST,
            md5(c.id || ${seed}) ASC
        `;
        total = orderedIds.length;
        // 정렬된 전체 ID — 상세 페이지에서 전체 고객을 끊김 없이 탐색하는 데 사용
        allIds = orderedIds.map((r) => r.id);

        const paginatedOrderedIds =
          limit > 0
            ? orderedIds.slice((page - 1) * limit, page * limit).map((r) => r.id)
            : orderedIds.map((r) => r.id);

        customers =
          paginatedOrderedIds.length > 0
            ? await prisma.customer.findMany({
                where: { id: { in: paginatedOrderedIds } },
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

        const orderMap = new Map(paginatedOrderedIds.map((id, i) => [id, i]));
        customers.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
      }
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

    // 블라인드DB 모드: 아래 중복/메모 매칭·부재 판정 블록을 모두 건너뛰고 마스킹된 목록을 반환한다.
    //   - duplicateWith는 같은 번호를 가진 타 고객의 name과 assignedUser.name을 반환하는 이름 유출 경로
    //   - 부재 판정(absenceIdSet)은 blindAt 이전 로그까지 세므로 손 탄 정도가 드러난다
    if (isBlindMode) {
      return NextResponse.json({
        success: true,
        data: maskBlindCustomerList(
          { id: session.user.id, role: session.user.role },
          customers,
          blindExtraById
        ),
        pagination: {
          page,
          limit,
          total,
          totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
        },
        ...(allIds && { allIds }),
      })
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

    // 현재 페이지 고객들의 '마지막 통화가 부재인지' 조회
    // - 통화 기록이 하나라도 있고 최근 것이 '부재' 포함이면 hasAbsence=true
    const absenceIdSet = new Set<string>();
    if (customers.length > 0) {
      const pageCustomerIds = customers.map((c) => c.id);
      const absenceRows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT c.id
        FROM "Customer" c
        INNER JOIN (
          SELECT "customerId", MAX("createdAt") AS latest
          FROM "CallLog"
          WHERE "customerId" IN (${Prisma.join(pageCustomerIds)})
          GROUP BY "customerId"
        ) t ON c.id = t."customerId"
        INNER JOIN "CallLog" cl ON cl."customerId" = c.id AND cl."createdAt" = t.latest
        WHERE cl.content LIKE '%부재%'
      `;
      absenceRows.forEach((r) => absenceIdSet.add(r.id));
    }

    // 메모 검색 시 매칭된 통화내용 조회
    const memoMatchMap = new Map<string, string[]>();
    if (memoSearch && customers.length > 0) {
      const customerIds = customers.map(c => c.id);
      const matchedCallLogs = await prisma.callLog.findMany({
        where: {
          customerId: { in: customerIds },
          content: { contains: memoSearch, mode: 'insensitive' },
        },
        select: {
          customerId: true,
          content: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      matchedCallLogs.forEach(log => {
        if (!memoMatchMap.has(log.customerId)) {
          memoMatchMap.set(log.customerId, []);
        }
        memoMatchMap.get(log.customerId)!.push(log.content || '');
      });
    }

    // 중복 여부, 블랙리스트 여부 추가
    const customersWithFlags = customers.map(customer => {
      const duplicates = duplicateMap.get(customer.phone) || [];
      // 자기 자신을 제외한 중복 고객들
      const otherDuplicates = duplicates.filter(d => d.id !== customer.id);
      const blacklistInfo = blacklistMap.get(customer.phone);

      // 메모 검색 시 매칭된 내용 수집
      const matchedContents: string[] = [];
      if (memoSearch) {
        // 메모에서 매칭
        if (customer.memo && customer.memo.toLowerCase().includes(memoSearch.toLowerCase())) {
          matchedContents.push(`[메모] ${customer.memo}`);
        }
        // 통화내용에서 매칭
        const callMatches = memoMatchMap.get(customer.id) || [];
        callMatches.forEach(content => {
          matchedContents.push(`[통화] ${content}`);
        });
      }

      return {
        ...customer,
        isDuplicate: duplicatePhoneSet.has(customer.phone),
        duplicateWith: otherDuplicates.length > 0 ? otherDuplicates : undefined,
        isBlacklisted: !!blacklistInfo,
        blacklistInfo: blacklistInfo || undefined,
        hasAbsence: absenceIdSet.has(customer.id),
        ...(matchedContents.length > 0 && { matchedContents }),
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
      // 공개DB 모드: 정렬된 전체 ID — 상세 페이지 이전/다음 탐색용
      ...(allIds && { allIds }),
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
        isBlind: true,
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

    // 블라인드DB 고객은 이름/이메일/담당자가 유출되지 않도록 최소 정보만 반환
    const duplicateCustomers = existingCustomers.map(({ isBlind, ...rest }) =>
      isBlind ? { id: rest.id, phone: rest.phone, isBlind: true } : rest
    )

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
        customers: duplicateCustomers,
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