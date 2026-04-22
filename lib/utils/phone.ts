/**
 * 전화번호에서 숫자만 추출하고 정규화
 * - 엑셀에서 앞의 0이 누락되는 케이스를 자동 보정
 * - 10자리 + 1로 시작 → 010 보정 (예: 1012345678 → 01012345678)
 * - 8자리 + 대표번호(15xx/16xx/18xx)가 아닌 경우 → 010 보정 (예: 12345678 → 01012345678)
 */
export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[^0-9]/g, '')

  // 10자리이면서 1로 시작하는 경우 (엑셀에서 앞의 0이 누락된 경우)
  // 예: 1012345678 → 01012345678
  if (normalized.length === 10 && normalized.startsWith('1')) {
    normalized = '0' + normalized
  }

  // 8자리이면서 대표번호 패턴이 아닌 경우 (엑셀에서 010이 통째로 빠진 경우)
  // 대표번호: 15xx, 16xx, 18xx로 시작하는 8자리
  // 그 외 8자리는 010 + 8자리로 보정 (예: 12345678 → 01012345678)
  if (normalized.length === 8 && !normalized.match(/^1[568]/)) {
    normalized = '010' + normalized
  }

  return normalized
}

/**
 * 전화번호 포맷팅 (010-1234-5678, 02-1234-5678, 031-123-4567 형식)
 */
export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone)

  // 11자리: 010-1234-5678
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`
  }
  // 10자리
  else if (normalized.length === 10) {
    // 02로 시작: 02-1234-5678
    if (normalized.startsWith('02')) {
      return `${normalized.slice(0, 2)}-${normalized.slice(2, 6)}-${normalized.slice(6)}`
    }
    // 기타: 031-123-4567
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`
  }
  // 9자리: 02-123-4567
  else if (normalized.length === 9 && normalized.startsWith('02')) {
    return `${normalized.slice(0, 2)}-${normalized.slice(2, 5)}-${normalized.slice(5)}`
  }
  // 8자리: 1588-1234
  else if (normalized.length === 8) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`
  }

  return normalized
}

/**
 * 전화번호 마스킹 (010-****-5678)
 */
export function maskPhone(phone: string): string {
  const formatted = formatPhone(phone)
  const parts = formatted.split('-')

  if (parts.length === 3) {
    return `${parts[0]}-****-${parts[2]}`
  }

  return formatted
}

/**
 * 전화번호 부분 마스킹 (010-3377-6922 → 010-**77-6922)
 * 중간 번호의 앞 2자리만 마스킹
 */
export function maskPhonePartial(phone: string): string {
  const formatted = formatPhone(phone)
  const parts = formatted.split('-')

  if (parts.length === 3 && parts[1].length >= 2) {
    const middlePart = parts[1]
    const masked = '**' + middlePart.slice(2)
    return `${parts[0]}-${masked}-${parts[2]}`
  }

  return formatted
}