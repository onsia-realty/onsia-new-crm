import { VisitStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { kstHoursMinutes, todayKstKey } from '@/components/visit-board/utils'
import {
  BOARD_VISIBLE_ROLES,
  HIDDEN_USER_NAMES,
  parseKstDayRange,
} from '@/lib/visits/board-scope'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export interface BriefingVisit {
  timeLabel: string // "오후 5시" / "오전 10시 30분" / "시간 미정"
  customerName: string
}

export interface BriefingUserRow {
  id: string
  name: string
  position: string // 비어있으면 '실장'으로 표기
  count: number
  visits: BriefingVisit[]
}

export interface DailyVisitBriefing {
  dateKey: string
  headerLabel: string // "6월 28일(토)"
  rows: BriefingUserRow[]
  totalTeams: number
  text: string // 카톡 붙여넣기용 전체 원문
}

/** UTC visitDate → KST 한국어 시각 라벨. 시간 미정이면 '시간 미정'. */
function formatKstTimeLabel(visitDate: Date, memo: string | null): string {
  const { hh, mm, hasTime } = kstHoursMinutes(visitDate.toISOString())
  const unknown = !hasTime || (memo?.includes('[시간 미정]') ?? false)
  if (unknown) return '시간 미정'

  const hour = Number(hh)
  const minute = Number(mm)
  const period = hour < 12 ? '오전' : '오후'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${period} ${h12}시${minute > 0 ? ` ${minute}분` : ''}`
}

function buildHeaderLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return `${m}월 ${d}일(${WEEKDAYS[dow]})`
}

/**
 * 특정 날짜(KST)의 직원별 방문 요약을 생성.
 * - 표시 대상: 활성 EMPLOYEE/TEAM_LEADER, 숨김 계정 제외 (예약방문 보드와 동일 스코프)
 * - 방문: 해당 KST 하루 구간, NO_SHOW/CANCELLED 제외
 * - 방문 없는 직원도 "없습니다"로 포함 (전 직원 표시)
 * cron 핸들러와 브리핑 페이지가 공유하는 단일 소스.
 */
export async function buildDailyVisitBriefing(
  dateKey: string = todayKstKey(),
): Promise<DailyVisitBriefing> {
  const range = parseKstDayRange(dateKey)
  if (!range) {
    throw new Error(`Invalid dateKey: ${dateKey}`)
  }

  const [users, visits] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: { in: BOARD_VISIBLE_ROLES },
        isActive: true,
        name: { notIn: HIDDEN_USER_NAMES },
      },
      select: { id: true, name: true, position: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }),
    prisma.visitSchedule.findMany({
      where: {
        visitDate: { gte: range.startUtc, lt: range.endUtc },
        status: { notIn: [VisitStatus.NO_SHOW, VisitStatus.CANCELLED] },
        userId: { not: null },
      },
      select: {
        userId: true,
        visitDate: true,
        memo: true,
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { visitDate: 'asc' },
    }),
  ])

  const visitsByUser = new Map<string, BriefingVisit[]>()
  for (const u of users) visitsByUser.set(u.id, [])
  for (const v of visits) {
    if (!v.userId) continue
    const list = visitsByUser.get(v.userId)
    if (!list) continue // 숨김/비활성 직원 방문은 표시 제외
    list.push({
      timeLabel: formatKstTimeLabel(v.visitDate, v.memo),
      customerName: v.customer.name || v.customer.phone,
    })
  }

  const rows: BriefingUserRow[] = users.map((u) => {
    const userVisits = visitsByUser.get(u.id) ?? []
    return {
      id: u.id,
      name: u.name,
      position: u.position || '실장',
      count: userVisits.length,
      visits: userVisits,
    }
  })

  const totalTeams = rows.reduce((sum, r) => sum + r.count, 0)
  const headerLabel = buildHeaderLabel(dateKey)

  // 카톡 원문: 방문 있는 사람을 순번으로 위에, 없는 사람은 한 줄로 압축
  const withVisits = rows.filter((r) => r.count > 0)
  const withoutVisits = rows.filter((r) => r.count === 0)

  const lines: string[] = [`📋 ${headerLabel} 당일 방문 보고`]

  if (withVisits.length > 0) {
    lines.push('')
    lines.push(`🔵 방문 예정 (총 ${totalTeams}팀)`)
    withVisits.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.name} ${r.position} · ${r.count}팀`)
      for (const v of r.visits) {
        lines.push(`   ⏰ ${v.timeLabel}  ${v.customerName}`)
      }
    })
  } else {
    lines.push('')
    lines.push('🔵 오늘 방문 예정이 없습니다.')
  }

  if (withoutVisits.length > 0) {
    lines.push('')
    lines.push(`⚪ 방문 없음 (${withoutVisits.length}명)`)
    for (const r of withoutVisits) {
      lines.push(`${r.name} - 방문 없습니다.`)
    }
  }

  return {
    dateKey,
    headerLabel,
    rows,
    totalTeams,
    text: lines.join('\n'),
  }
}
