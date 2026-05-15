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
 * `getKoreaTodayStart`의 별칭. 의도 표현이 다른 곳에서 사용.
 */
export function getKoreaToday(): Date {
  return getKoreaTodayStart()
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
