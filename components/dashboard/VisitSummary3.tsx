'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePolling } from '@/hooks/use-polling'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Plus, RotateCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { VBadge, cycleConfirm } from '@/components/visit-board/VBadge'
import type { BoardData, BoardVisit } from '@/components/visit-board/types'
import {
  ADMIN_ROLES,
  formatDateLabel,
  kstHoursMinutes,
  shiftDateKey,
  teamBadgeStyle,
  todayKstKey,
  weekendKeys,
} from '@/components/visit-board/utils'

interface VisitSummary3Props {
  compact?: boolean
  onQuickAdd?: () => void
  pollMs?: number
}

interface SectionData {
  title: string
  dateKey: string
  board: BoardData | null
}

// 사용자 요청: 오늘 / 내일 / 토 / 일 = 4섹션. 컴포넌트 이름은 기존 그대로 유지.
export function VisitSummary3({ compact = false, onQuickAdd, pollMs = 120000 }: VisitSummary3Props) {
  const { data: session } = useSession()
  const role = (session?.user?.role as string | undefined) ?? ''
  const isAdmin = ADMIN_ROLES.has(role)
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sections, setSections] = useState<SectionData[] | null>(null)

  const candidates = useMemo(() => {
    const today = todayKstKey()
    const tomorrow = shiftDateKey(today, 1)
    const [y, m, d] = today.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay() // 0=일 ... 6=토
    const isWeekend = dow === 0 || dow === 6

    // 주말(토/일)에는 평일 칸을 굳이 두지 않음 → 오늘/내일 2칸만
    if (isWeekend) {
      return [
        { dateKey: today, title: '오늘' },
        { dateKey: tomorrow, title: '내일' },
      ]
    }
    // 평일: 평일(오늘/내일) + 다가올 주말(토/일) 4칸. 금요일은 내일=토라 자동 머지됨.
    const { sat, sun } = weekendKeys(today)
    return [
      { dateKey: today, title: '오늘' },
      { dateKey: tomorrow, title: '내일' },
      { dateKey: sat, title: '토요일' },
      { dateKey: sun, title: '일요일' },
    ]
  }, [])

  const fetchAll = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        // 같은 일자에 여러 라벨이 붙으면 라벨을 ' · '로 합쳐 한 카드로 표시 (예: 금요일에 '내일 · 토요일')
        const labelsByDate = new Map<string, string[]>()
        candidates.forEach(({ dateKey, title }) => {
          if (!labelsByDate.has(dateKey)) labelsByDate.set(dateKey, [])
          labelsByDate.get(dateKey)!.push(title)
        })
        const uniqueDates = Array.from(labelsByDate.keys())

        const fetched = await Promise.all(
          uniqueDates.map((d) =>
            fetch(`/api/visit-board?date=${d}`, { cache: 'no-store' })
              .then((r) => r.json())
              .then((j) => ({ date: d, data: j?.success ? (j.data as BoardData) : null }))
              .catch(() => ({ date: d, data: null }))
          )
        )
        const byDate = new Map(fetched.map((f) => [f.date, f.data]))
        setSections(
          uniqueDates.map((d) => ({
            title: (labelsByDate.get(d) ?? []).join(' · '),
            dateKey: d,
            board: byDate.get(d) ?? null,
          }))
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [candidates]
  )

  const pollHandler = useCallback(() => {
    void fetchAll(true)
  }, [fetchAll])
  // 첫 마운트 1회: 스피너 표시(silent=false), 이후 폴링은 silent
  const initialFetch = useCallback(() => {
    void fetchAll(false)
  }, [fetchAll])
  usePolling(initialFetch, 0, { runOnMount: true }) // 초기 로드만
  usePolling(pollHandler, pollMs, { runOnMount: false }) // 이후 폴링 (백그라운드 시 정지)

  const handleToggleV = async (visit: BoardVisit) => {
    const next = cycleConfirm(visit.confirmStatus)
    setSections((prev) => {
      if (!prev) return prev
      return prev.map((s) => {
        if (!s.board) return s
        return {
          ...s,
          board: {
            ...s.board,
            visits: s.board.visits.map((v) => (v.id === visit.id ? { ...v, confirmStatus: next } : v)),
          },
        }
      })
    })
    try {
      await fetch(`/api/visit-board/${visit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmStatus: next }),
      })
    } catch {
      /* 다음 폴링에서 정정 */
    }
  }

  const todayKey = candidates[0]?.dateKey ?? todayKstKey()

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs md:text-sm text-muted-foreground">
          {refreshing ? '갱신 중…' : `${formatDateLabel(todayKey)} 기준`}
        </div>
        <div className="flex items-center gap-1.5">
          {onQuickAdd && (
            <Button size="sm" onClick={onQuickAdd} type="button">
              <Plus className="w-4 h-4 mr-1" /> 빠른 등록
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            title="새로고침"
            className="h-8 w-8"
            type="button"
          >
            <RotateCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading && !sections && <SkeletonSections />}

        {sections?.map((section) => (
          <SectionTable
            key={section.dateKey}
            section={section}
            compact={compact}
            myId={myId}
            isAdmin={isAdmin}
            onToggleV={handleToggleV}
          />
        ))}
      </div>
    </div>
  )
}

function SectionTable({
  section,
  compact,
  myId,
  isAdmin,
  onToggleV,
}: {
  section: SectionData
  compact: boolean
  myId: string | undefined
  isAdmin: boolean
  onToggleV: (v: BoardVisit) => void
}) {
  const visits = section.board?.visits ?? []
  const byUser = new Map<string, BoardVisit[]>()
  visits.forEach((v) => {
    if (!v.userId) return
    if (!byUser.has(v.userId)) byUser.set(v.userId, [])
    byUser.get(v.userId)!.push(v)
  })
  const userList = section.board?.users ?? []
  // compact 모드: 일정이 있는 직원만. full 모드: 전 직원 (방문 없음 포함)
  const visibleUsers = compact ? userList.filter((u) => (byUser.get(u.id)?.length ?? 0) > 0) : userList
  const totalTeams = visits.length

  return (
    <Card>
      <CardHeader className="py-2.5 px-3 md:px-4 bg-gray-50 border-b">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <CardTitle className="text-sm md:text-base flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">📅 {section.title}</span>
            <span className="text-[11px] md:text-xs font-normal text-muted-foreground">
              {formatDateLabel(section.dateKey).split(' ').slice(1).join(' ')}
            </span>
            <Link
              href={`/dashboard/visit-board?date=${section.dateKey}`}
              className="text-[11px] md:text-xs font-normal text-blue-600 hover:underline"
            >
              보드 →
            </Link>
          </CardTitle>
          <Badge className={cn('rounded-full px-2.5 py-0.5 text-xs md:text-sm font-semibold', teamBadgeStyle(totalTeams))}>
            {totalTeams}팀
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {visibleUsers.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 px-4 text-center">예정된 방문이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead className="bg-gray-50 text-gray-500 text-[10px] md:text-xs">
                <tr>
                  <th className="text-left px-2 md:px-3 py-1.5 font-medium w-[88px] md:w-[120px]">담당자</th>
                  <th className="text-left px-2 md:px-3 py-1.5 font-medium w-[64px] md:w-[78px]">시간</th>
                  <th className="text-left px-2 md:px-3 py-1.5 font-medium">고객</th>
                  <th className="text-center px-1 md:px-2 py-1.5 font-medium w-[40px] md:w-[48px]">V</th>
                  <th className="text-right px-2 md:px-3 py-1.5 font-medium w-[48px] md:w-[60px]">팀수</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => {
                  const list = byUser.get(u.id) ?? []
                  const rowCount = Math.max(1, list.length)
                  if (list.length === 0) {
                    return (
                      <tr key={u.id} className="border-t">
                        <td className="px-2 md:px-3 py-2 align-top">
                          <div className="font-semibold leading-tight">{u.name}</div>
                          {u.position && <div className="hidden md:block text-[11px] text-muted-foreground">{u.position}</div>}
                        </td>
                        <td className="px-2 md:px-3 py-2 text-muted-foreground" colSpan={3}>방문 없음</td>
                        <td className="px-2 md:px-3 py-2 text-right">
                          <Badge className={cn('rounded-full px-1.5 py-0.5 text-[10px] md:text-xs', teamBadgeStyle(0))}>0팀</Badge>
                        </td>
                      </tr>
                    )
                  }
                  return list.map((v, idx) => {
                    const t = kstHoursMinutes(v.visitDate)
                    const isUnknown = !t.hasTime || (v.memo?.includes('[시간 미정]') ?? false)
                    const isNoShow = v.confirmStatus === 'NO_SHOW'
                    const isChanged = v.confirmStatus === 'CHANGED'
                    const canEdit = isAdmin || v.user?.id === myId
                    return (
                      <tr key={v.id} className={cn('border-t', idx > 0 && 'border-t-0 border-dashed border-gray-100')}>
                        <td className="px-2 md:px-3 py-2 align-top">
                          {idx === 0 ? (
                            <>
                              <div className="font-semibold leading-tight">{u.name}</div>
                              {u.position && <div className="hidden md:block text-[11px] text-muted-foreground">{u.position}</div>}
                            </>
                          ) : null}
                        </td>
                        <td className="px-2 md:px-3 py-2 align-top font-semibold tabular-nums">
                          {isUnknown ? <span className="text-muted-foreground text-[11px]">시간미정</span> : t.hhmm}
                          {isChanged && v.previousDate && (
                            <div className="text-[10px] text-sky-600 mt-0.5">전 {kstHoursMinutes(v.previousDate).hhmm}</div>
                          )}
                        </td>
                        <td className="px-2 md:px-3 py-2 align-top">
                          <span className={cn('font-medium', isNoShow && 'line-through text-rose-500')}>
                            {v.customer.name || v.customer.phone}
                          </span>
                          {v.customer.assignedSite && !compact && (
                            <span className="ml-2 hidden md:inline text-xs text-muted-foreground">· {v.customer.assignedSite}</span>
                          )}
                        </td>
                        <td className="px-1 md:px-2 py-2 text-center align-top">
                          <VBadge
                            size="sm"
                            status={v.confirmStatus}
                            onClick={() => canEdit && onToggleV(v)}
                            disabled={!canEdit}
                          />
                        </td>
                        <td className="px-2 md:px-3 py-2 text-right align-top">
                          {idx === 0 && (
                            <Badge className={cn('rounded-full px-1.5 py-0.5 text-[10px] md:text-xs', teamBadgeStyle(rowCount))}>
                              {rowCount}팀
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t">
                  <td className="px-2 md:px-3 py-1.5 text-[10px] md:text-xs text-muted-foreground" colSpan={4}>총 방문</td>
                  <td className="px-2 md:px-3 py-1.5 text-right">
                    <span className="text-sm md:text-base font-bold">{totalTeams}</span>
                    <span className="ml-1 text-[10px] md:text-xs text-muted-foreground">팀</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SkeletonSections() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="py-3 px-4 bg-gray-50 border-b">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="grid grid-cols-[140px_90px_1fr_60px_70px] items-center gap-3">
                <div className="h-4 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </>
  )
}
