/**
 * 전화번호에서 숫자만 추출하고 정규화
 * - 10-XXXX-XXXX 형식이면 앞에 0을 추가하여 010-XXXX-XXXX로 변환
 */
export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[^0-9]/g, '')

  // 10자리이면서 1로 시작하는 경우 (엑셀에서 앞의 0이 누락된 경우)
  // 예: 10-1234-5678 → 0101234567 → 01012345678
  if (normalized.length === 10 && normalized.startsWith('1')) {
    normalized = '0' + normalized
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