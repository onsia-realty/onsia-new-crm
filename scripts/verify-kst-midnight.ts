// KST 자정 헬퍼가 정확한지 검증
// 실행: pnpm tsx scripts/verify-kst-midnight.ts
import {
  getKoreaTodayStart,
  getKoreaTodayEnd,
  getKoreaMonthStart,
  getKoreaNow,
} from '../lib/date-utils'

const start = getKoreaTodayStart()
const end = getKoreaTodayEnd()
const monthStart = getKoreaMonthStart()
const now = getKoreaNow()

console.log('현재 (UTC):', new Date().toISOString())
console.log('현재 (KST 표시용):', now.toISOString().replace('Z', ''), ' ← 표시·요일 추출용')
console.log('')
console.log('오늘 시작 (KST 자정의 UTC ms):')
console.log('  toISOString:', start.toISOString())
console.log('  KST로 환산:', new Date(start.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('Z', ' (KST)'))
console.log('')
console.log('오늘 끝 (다음 KST 자정의 UTC ms):')
console.log('  toISOString:', end.toISOString())
console.log('  KST로 환산:', new Date(end.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('Z', ' (KST)'))
console.log('')
console.log('이번 달 시작 (KST 1일 자정의 UTC ms):')
console.log('  toISOString:', monthStart.toISOString())
console.log('  KST로 환산:', new Date(monthStart.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('Z', ' (KST)'))
