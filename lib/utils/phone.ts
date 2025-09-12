/**
 * 전화번호에서 숫자만 추출
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

/**
 * 전화번호 포맷팅 (010-1234-5678 형식)
 */
export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone)
  
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`
  } else if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`
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