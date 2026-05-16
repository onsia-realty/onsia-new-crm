// 한국 시간(KST = UTC+9) 기준 날짜 유틸.
// 핵심 원칙: prisma `createdAt: { gte, lt }` 비교용으로 쓰는 Date는
// "KST 자정의 정확한 UTC ms epoch"이어야 함.
// 서버 timezone(Vercel=UTC, 로컬=KST 등)에 영향받지 않도록 Intl로 KST 년월일을 추출 후 Date.UTC로 epoch 계산.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function ymdKst(now: Date = new Date()): { y: number; m: number; d: number } {
  // 'en-CA'는 'YYYY-MM-DD' 포맷을 보장
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [y, m, d] = fmt.format(now).split('-').map(Number)
  return { y, m, d }
}

/**
 * 한국 시간 기준 오늘 자정(00:00:00 KST)의 정확한 UTC ms를 가진 Date 객체.
 * prisma where { gte } 에 그대로 사용 가능.
 */
export function getKoreaTodayStart(): Date {
  const { y, m, d } = ymdKst()
  return new Date(Date.UTC(y, m - 1, d) - KST_OFFSET_MS)
}

/**
 * 한국 시간 기준 "오늘"의 캘린더 날짜(YYYY-MM-DD)를 UTC 자정으로 표현한 Date.
 *
 * 용도: Postgres `DATE` (Prisma `@db.Date`) 컬럼에 저장/조회하는 경우.
 * `@db.Date`는 시간 정보를 버리고 캘린더 날짜만 저장하는데, UTC 세션 Postgres에
 * "KST 자정의 UTC ms"(예: 2026-05-15T15:00:00Z)를 넘기면 캘린더상 전날(05-15)로
 * 캐스팅되어 어제 row가 매칭되는 버그가 발생함.
 *
 * 따라서 KST 캘린더 날짜를 UTC 자정 Date로 인코딩해 전달 (예: KST 5/16 → 2026-05-16T00:00:00Z).
 * 이 값을 `@db.Date`에 저장하면 UTC 세션에서 캘린더 날짜 '2026-05-16'으로 정확히 저장됨.
 *
 * 절대 `createdAt: { gte }` 같은 timestamp 비교에 사용 금지 — `getKoreaTodayStart`를 사용.
 */
export function getKoreaToday(): Date {
  const { y, m, d } = ymdKst()
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * 한국 시간 기준 오늘 종료(다음날 00:00 KST)의 정확한 UTC ms.
 * prisma where { lt } 에 사용 (gte/lt 반열림 구간).
 */
export function getKoreaTodayEnd(): Date {
  return new Date(getKoreaTodayStart().getTime() + 24 * 60 * 60 * 1000)
}

/**
 * 한국 시간 기준 "오늘"이 속한 달의 1일 00:00 KST 정확한 UTC ms.
 */
export function getKoreaMonthStart(): Date {
  const { y, m } = ymdKst()
  return new Date(Date.UTC(y, m - 1, 1) - KST_OFFSET_MS)
}

/**
 * 한국 시간 기준 현재 시각을 "UTC인 척 표현한 Date".
 * dayOfWeek / month / year 추출 등 표시·계산용으로만 사용.
 * 이 Date의 ms epoch은 KST 시각을 UTC로 잘못 표현한 값이라 DB 비교에 쓰면 안 됨.
 */
export function getKoreaNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
}
