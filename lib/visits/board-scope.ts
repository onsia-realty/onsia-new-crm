// 예약방문 보드 / 방문 브리핑 공용 스코프
// 보드와 브리핑이 "같은 직원 집합·같은 날짜 윈도우"를 보도록 단일 소스로 둔다.
// (테스트/숨김 계정 목록이 양쪽에서 반드시 일치해야 함 — 분산되면 누락 위험)

export type BoardRole = 'EMPLOYEE' | 'TEAM_LEADER' | 'HEAD' | 'ADMIN' | 'CEO'

export const ADMIN_ROLES: BoardRole[] = ['HEAD', 'ADMIN', 'CEO']

// 보드/브리핑 행으로 노출할 role (관리자/대표는 행에서 제외, 단 본인 권한으로는 열람 가능)
export const BOARD_VISIBLE_ROLES: BoardRole[] = ['EMPLOYEE', 'TEAM_LEADER']

// 보드/브리핑에서 숨길 사용자 이름 (테스트 계정/비영업 직원). 추후 User 모델에 flag 추가 시 대체.
export const HIDDEN_USER_NAMES = ['남은희', '테스트 11', '관리자', '김수경', '연대겸']

/**
 * KST 자정 ~ 다음날 자정 구간을 UTC 범위로 환산.
 * 저장된 visitDate(UTC)를 해당 KST 하루로 조회할 때 사용.
 */
export function parseKstDayRange(
  dateStr: string | null,
): { startUtc: Date; endUtc: Date; dateKey: string } | null {
  if (!dateStr) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return null
  const [, y, mo, d] = m
  const kstStart = new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0, 0)
  const startUtc = new Date(kstStart.getTime() - 9 * 60 * 60 * 1000)
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)
  return { startUtc, endUtc, dateKey: dateStr }
}
