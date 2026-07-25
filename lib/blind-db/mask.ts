// 블라인드DB 마스킹 — 이 기능의 보안 단일 진실(single source of truth).
//
// 기존 LMS광고(app/api/customers/lms-ad/route.ts) 관례를 따라 UI가 아니라
// 서버 응답 스키마 레벨에서 필드를 아예 빼는 방식이다. 클라이언트로 나가지
// 않은 값은 되살릴 수 없다.
//
// 순수 함수만 둔다 — prisma를 import하지 않는다. 호출부가 데이터를 넘긴다.
import { BLIND_ADMIN_BYPASS, BLIND_OWNER_SEES_OWN } from '@/lib/constants/blind-db'

export type BlindViewer = { id: string; role: string }

export type BlindState = {
  isBlind: boolean
  blindAt: Date | null
  blindById: string | null
  assignedUserId: string | null
}

/** 이 viewer에게 이 고객의 이름 + blindAt 이전 기록을 가려야 하는가 */
export function isBlindHidden(viewer: BlindViewer, c: BlindState): boolean {
  if (!c.isBlind) return false // 클레임 완료 → 전체 열람
  if (!c.blindAt) return true // 경계선을 모르면 전부 가린다 (fail-closed)
  if (c.assignedUserId === viewer.id) return false // 방어적 (블라인드 중엔 항상 null)
  if (BLIND_OWNER_SEES_OWN && c.blindById === viewer.id) return false // 원 소유자 = 자기 데이터
  if (BLIND_ADMIN_BYPASS && ['ADMIN', 'CEO'].includes(viewer.role)) return false
  return true
}

/**
 * 목록/카운트/검색에서 원 소유자 등록건을 제외하는 where 조각.
 * ⚠ Prisma의 nullable `not`은 `<> value` SQL로 번역되어 NULL 행이 조용히 사라질 수
 *   있으므로 반드시 OR로 명시한다. (blindById=null인 과거 데이터 보호)
 * ⚠ 호출부는 top-level에 spread하지 말고 반드시 AND 배열에 넣어라. 이 조각은 `OR`을
 *   쓰는데, app/api/customers/route.ts의 callFilter도 `where.OR`을 쓰므로 spread하면
 *   한쪽이 조용히 덮인다.
 *     where.AND = [...(where.AND ?? []), excludeOwnBlindEntries(viewerId)]
 */
export function excludeOwnBlindEntries(viewerId: string) {
  return { OR: [{ blindById: null }, { NOT: { blindById: viewerId } }] }
}

/**
 * 응답 허용 키 화이트리스트. 이 4개가 전부다.
 * maskBlindCustomer()의 반환 객체 리터럴과 1:1로 일치해야 하며,
 * tests/blind-db-mask.test.ts가 이를 검증한다.
 */
export const BLIND_CUSTOMER_ALLOWED_FIELDS = ['id', 'phone', 'isBlind', 'blindAt'] as const

/**
 * 명시적 denylist — 절대 응답에 실리면 안 되는 키.
 * Customer 스칼라 34개 + 관계 7개 + duplicateWith + _count.
 *
 * `name`이 여기 들어가는 것이 이 기능의 핵심이다. 이름이 보이면 이전 담당자가
 * 누구를 어떻게 분류했는지가 드러난다.
 *
 * `_count`도 막는다: `_count.callLogs`를 그대로 실으면 가려진 이력의 규모가
 * 노출되어 "손 많이 탄 번호 선별"이 그대로 가능해진다. visibleCallCount로 대체한다.
 */
export const BLIND_CUSTOMER_DENIED_FIELDS = [
  // Customer 스칼라
  'displayOrder',
  'name',
  'email',
  'address',
  'memo',
  'nextVisitDate',
  'assignedSite',
  'gender',
  'ageRange',
  'residenceArea',
  'familyRelation',
  'occupation',
  'source',
  'investmentStyle',
  'expectedBudget',
  'ownedProperties',
  'recentVisitedMH',
  'grade',
  'assignedUserId',
  'assignedAt',
  'createdAt',
  'updatedAt',
  'isDeleted',
  'isDuplicate',
  'isPublic',
  'publicAt',
  'publicById',
  'materialSent',
  'materialSentAt',
  'lmsEligible',
  'lmsAd',
  'lmsAdAt',
  'lmsAdById',
  'blindById', // 올린 직원 — 누가 버린 번호인지 드러나므로 노출 금지
  // 관계 + 파생
  'assignedUser',
  'interestCards',
  'visitSchedules',
  'callLogs',
  'allocations',
  'transferRequests',
  'prizeWinners',
  'duplicateWith',
  '_count',
] as const

/**
 * 마스킹된 응답에 함께 실을 수 있는 파생값.
 * isBlacklisted/blacklistInfo는 의도적 허용 — 전화금지 경고는 안전 기능이고
 * 블랙리스트는 전화번호 기반 공개 정보다.
 */
export type BlindMaskExtra = {
  visibleCallCount?: number
  hasAbsence?: boolean
  hiddenCallLogCount?: number
  absenceCountTotal?: number
  isBlacklisted?: boolean
  blacklistInfo?: unknown
  isOwnBlindEntry?: boolean
}

export type MaskedBlindCustomer = {
  id: string
  phone: string
  isBlind: boolean
  blindAt: Date | null
  blindMasked: true
} & BlindMaskExtra

type BlindMaskable = { id: string; phone: string; isBlind: boolean; blindAt: Date | null }

/**
 * 화이트리스트 pick + blindMasked 표식 + 파생값.
 * `name`은 null로 주지 않고 키 자체를 뺀다 — null이면 클라이언트가 "이름 없음"으로
 * 렌더해 실제 무명 고객과 구분이 안 되고, 나중에 누가 `?? customer.name`으로
 * 되살릴 여지가 남는다.
 */
export function maskBlindCustomer(
  customer: BlindMaskable,
  extra?: BlindMaskExtra
): MaskedBlindCustomer {
  return {
    id: customer.id,
    phone: customer.phone,
    isBlind: customer.isBlind,
    blindAt: customer.blindAt,
    blindMasked: true,
    ...extra,
  }
}

/** 배열용 — 행마다 판정해서 가려야 하는 행만 마스킹하고 나머지는 원본 유지 */
export function maskBlindCustomerList<T extends BlindMaskable & BlindState>(
  viewer: BlindViewer,
  rows: T[],
  extraById?: Record<string, BlindMaskExtra>
): (T | MaskedBlindCustomer)[] {
  return rows.map((row) =>
    isBlindHidden(viewer, row) ? maskBlindCustomer(row, extraById?.[row.id]) : row
  )
}

type BlindCallLog = { content: string; createdAt: Date }

/**
 * blindAt 이후 생성된 통화기록만 통과시킨다. 경계값은 `>=` — 등록 직후 생성된
 * 로그가 잘리면 안 된다.
 *
 * absenceCountTotal은 가려진 것까지 포함한 전체 부재 로그 수다.
 *   → 상세 페이지 handleAddAbsence가 부재 차수를 `부재 로그 수 + 1`로 계산하므로,
 *     가려진 로그를 못 세면 "1차 부재"가 중복 생성되는 실제 버그가 생긴다.
 * hiddenCount는 노출한다 — 가져오면 N건이 열린다는 클레임 동기이자 UI
 *   placeholder 근거다. 개수만으로는 내용을 알 수 없다.
 * (부재는 별도 컬럼 없이 content에 "1차 부재" 형태 문자열 — 전 코드베이스 공통 관례)
 */
export function filterBlindCallLogs<T extends BlindCallLog>(
  logs: T[],
  blindAt: Date | null
): { visible: T[]; hiddenCount: number; absenceCountTotal: number } {
  const absenceCountTotal = logs.filter((l) => l.content.includes('부재')).length
  if (!blindAt) {
    return { visible: [], hiddenCount: logs.length, absenceCountTotal } // fail-closed
  }
  const cutoff = blindAt.getTime()
  const visible = logs.filter((l) => l.createdAt.getTime() >= cutoff)
  return { visible, hiddenCount: logs.length - visible.length, absenceCountTotal }
}
