export const ADMIN_ROLES = new Set(['ADMIN', 'HEAD', 'CEO'])
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function todayKstKey(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60 * 1000)
  const y = kst.getFullYear()
  const m = String(kst.getMonth() + 1).padStart(2, '0')
  const d = String(kst.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function shiftDateKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  const ny = dt.getFullYear()
  const nm = String(dt.getMonth() + 1).padStart(2, '0')
  const nd = String(dt.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

export function formatDateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${y}년 ${m}월 ${d}일 ${WEEKDAYS[dt.getDay()]}요일`
}

export function shortDateLabel(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  const [y, mo, dd] = key.split('-').map(Number)
  const dt = new Date(y, mo - 1, dd)
  return `${m}/${d} (${WEEKDAYS[dt.getDay()]})`
}

export function kstHoursMinutes(iso: string): {
  hh: string
  mm: string
  hhmm: string
  hasTime: boolean
} {
  const utc = new Date(iso)
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000)
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mm = String(kst.getUTCMinutes()).padStart(2, '0')
  return { hh, mm, hhmm: `${hh}:${mm}`, hasTime: !(hh === '00' && mm === '00') }
}

export function timeSlots(): string[] {
  const out: string[] = []
  for (let h = 8; h <= 22; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`)
    if (h !== 22) out.push(`${String(h).padStart(2, '0')}:30`)
  }
  return out
}

export const SLOTS = timeSlots()

export function teamBadgeStyle(count: number): string {
  if (count === 0) return 'bg-gray-100 text-gray-600'
  if (count === 1) return 'bg-emerald-100 text-emerald-700'
  if (count === 2) return 'bg-violet-100 text-violet-700'
  if (count === 3) return 'bg-sky-100 text-sky-700'
  return 'bg-orange-100 text-orange-700'
}

// 다가오는 이번 주 토·일 (KST 오늘이 토/일이면 이번 주 토/일, 평일이면 다가올 토/일)
export function weekendKeys(refKey: string = todayKstKey()): { sat: string; sun: string } {
  const [y, m, d] = refKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() // 0=일 ... 6=토
  const diffToSat = (6 - dow + 7) % 7 // 토요일까지 며칠
  const sat = shiftDateKey(refKey, diffToSat)
  const sun = shiftDateKey(sat, 1)
  return { sat, sun }
}
