'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Plus, ChevronLeft, ChevronRight, CalendarDays, RotateCw, Trash2 } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

import { VisitSummary3 } from '@/components/dashboard/VisitSummary3'
import AddScheduleDialog from '@/components/schedules/AddScheduleDialog'
import { VBadge, cycleConfirm } from '@/components/visit-board/VBadge'
import type { BoardData, BoardVisit } from '@/components/visit-board/types'
import {
  ADMIN_ROLES,
  formatDateLabel,
  kstHoursMinutes,
  shiftDateKey,
  teamBadgeStyle,
  todayKstKey,
} from '@/components/visit-board/utils'

function dateToKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function SchedulesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { toast } = useToast()

  const role = (session?.user?.role as string | undefined) ?? ''
  const isAdmin = ADMIN_ROLES.has(role)
  const myId = session?.user?.id

  const dateParam = searchParams.get('date')
  const showSummary = !dateParam

  const selectedKey = dateParam || todayKstKey()
  const selectedDate = useMemo(() => keyToDate(selectedKey), [selectedKey])

  const [board, setBoard] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [stats, setStats] = useState<{ today: number; week: number; checked: number; noShow: number } | null>(null)

  // 단일 일자 모드 — board 조회
  useEffect(() => {
    if (showSummary) {
      setBoard(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/visit-board?date=${selectedKey}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) setBoard(json.data as BoardData)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    const t = setInterval(() => {
      fetch(`/api/visit-board?date=${selectedKey}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((json) => {
          if (cancelled) return
          if (json.success) setBoard(json.data as BoardData)
        })
        .catch(() => {})
    }, 60000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [selectedKey, showSummary, refreshKey])

  // 통계 — 가벼운 month 단위 호출
  useEffect(() => {
    const today = todayKstKey()
    const [y, m] = today.split('-').map(Number)
    const monthKey = `${y}-${String(m).padStart(2, '0')}`
    fetch(`/api/visit-schedules?month=${monthKey}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success && !json.data) return
        const list = (json.data ?? []) as Array<{ visitDate: string; status: string }>
        const todayCount = list.filter((v) => v.visitDate.slice(0, 10) === today).length
        const weekStart = (() => {
          const dt = keyToDate(today)
          const day = dt.getDay()
          dt.setDate(dt.getDate() - day)
          return dateToKey(dt)
        })()
        const weekEnd = shiftDateKey(weekStart, 6)
        const weekCount = list.filter((v) => {
          const k = v.visitDate.slice(0, 10)
          return k >= weekStart && k <= weekEnd
        }).length
        const checked = list.filter((v) => v.status === 'CHECKED' || v.status === 'COMPLETED').length
        const noShow = list.filter((v) => v.status === 'NO_SHOW').length
        setStats({ today: todayCount, week: weekCount, checked, noShow })
      })
      .catch(() => {})
  }, [refreshKey])

  const handleSelectDate = (d: Date | undefined) => {
    if (!d) {
      router.push('/dashboard/schedules')
      return
    }
    const key = dateToKey(d)
    if (key === selectedKey && !showSummary) {
      router.push('/dashboard/schedules')
    } else {
      router.push(`/dashboard/schedules?date=${key}`)
    }
  }

  const handleToggleV = async (visit: BoardVisit) => {
    const next = cycleConfirm(visit.confirmStatus)
    setBoard((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        visits: prev.visits.map((v) => (v.id === visit.id ? { ...v, confirmStatus: next } : v)),
      }
    })
    try {
      await fetch(`/api/visit-board/${visit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmStatus: next }),
      })
    } catch {
      toast({ title: '상태 변경 실패', variant: 'destructive' })
    }
  }

  const handleDelete = async (visit: BoardVisit) => {
    if (!confirm(`${visit.customer.name || visit.customer.phone} 방문을 삭제할까요?`)) return
    try {
      await fetch(`/api/visit-board/${visit.id}`, { method: 'DELETE' })
      toast({ title: '삭제되었습니다' })
      setRefreshKey((k) => k + 1)
    } catch {
      toast({ title: '삭제 실패', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight">방문 일정</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {showSummary ? '오늘 · 내일 · 이번 주말' : formatDateLabel(selectedKey)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setQuickAddOpen(true)} type="button">
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">방문 예약 등록</span>
            <span className="sm:hidden">예약 등록</span>
          </Button>
          {!showSummary && (
            <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/schedules')} type="button">
              <CalendarDays className="w-4 h-4 mr-1" /> 요약 보기
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 좌측 사이드 — 미니 캘린더 + 통계 */}
        <aside className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">날짜 선택</CardTitle>
                {!showSummary && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => router.push('/dashboard/schedules')}
                  >
                    초기화
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <Calendar
                mode="single"
                selected={showSummary ? undefined : selectedDate}
                onSelect={handleSelectDate}
                className="w-full"
              />
              <div className="flex items-center justify-between gap-1 mt-2 px-2 pb-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs"
                  onClick={() => handleSelectDate(keyToDate(shiftDateKey(selectedKey, -1)))}
                >
                  <ChevronLeft className="w-3 h-3 mr-0.5" /> 전날
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs"
                  onClick={() => handleSelectDate(keyToDate(todayKstKey()))}
                >
                  오늘
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs"
                  onClick={() => handleSelectDate(keyToDate(shiftDateKey(selectedKey, 1)))}
                >
                  다음날 <ChevronRight className="w-3 h-3 ml-0.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-base">이번 달 요약</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-sm">
              <StatRow label="오늘 일정" value={stats?.today ?? '—'} accent="emerald" />
              <StatRow label="이번 주" value={stats?.week ?? '—'} accent="sky" />
              <StatRow label="완료" value={stats?.checked ?? '—'} accent="violet" />
              <StatRow label="노쇼" value={stats?.noShow ?? '—'} accent="rose" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" /> 🟢 변함없음
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-sky-500" /> 🔵 변동됨
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-rose-500" /> 🔴 방문 깨짐 (취소선)
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* 메인 영역 */}
        <section className="lg:col-span-2 space-y-4">
          {showSummary ? (
            <VisitSummary3 key={refreshKey} onQuickAdd={() => setQuickAddOpen(true)} />
          ) : (
            <SingleDayBoard
              board={board}
              loading={loading}
              dateKey={selectedKey}
              myId={myId}
              isAdmin={isAdmin}
              onToggleV={handleToggleV}
              onDelete={handleDelete}
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          )}
        </section>
      </div>

      <AddScheduleDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        preselectedDate={selectedDate}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}

function StatRow({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', `text-${accent}-600`)}>{value}</span>
    </div>
  )
}

function SingleDayBoard({
  board,
  loading,
  dateKey,
  myId,
  isAdmin,
  onToggleV,
  onDelete,
  onRefresh,
}: {
  board: BoardData | null
  loading: boolean
  dateKey: string
  myId: string | undefined
  isAdmin: boolean
  onToggleV: (v: BoardVisit) => void
  onDelete: (v: BoardVisit) => void
  onRefresh: () => void
}) {
  const visits = board?.visits ?? []
  const byUser = new Map<string, BoardVisit[]>()
  visits.forEach((v) => {
    if (!v.userId) return
    if (!byUser.has(v.userId)) byUser.set(v.userId, [])
    byUser.get(v.userId)!.push(v)
  })
  const users = board?.users ?? []

  return (
    <Card>
      <CardHeader className="py-3 px-4 bg-gray-50 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            📅 {formatDateLabel(dateKey)}
            <Link
              href={`/dashboard/visit-board?date=${dateKey}`}
              className="ml-2 text-xs font-normal text-blue-600 hover:underline"
            >
              보드 모드로 열기 →
            </Link>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={cn('rounded-full px-3 py-0.5 text-sm font-semibold', teamBadgeStyle(visits.length))}>
              총 {visits.length}팀
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} title="새로고침">
              <RotateCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading && !board ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : visits.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">예정된 방문이 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium w-[140px]">담당자</th>
                <th className="text-left px-4 py-2 font-medium w-[90px]">시간</th>
                <th className="text-left px-4 py-2 font-medium">고객</th>
                <th className="text-center px-4 py-2 font-medium w-[80px]">V</th>
                <th className="text-right px-4 py-2 font-medium w-[80px]">팀수</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const list = byUser.get(u.id) ?? []
                if (list.length === 0) return null
                return list.map((v, idx) => {
                  const t = kstHoursMinutes(v.visitDate)
                  const isUnknown = !t.hasTime || (v.memo?.includes('[시간 미정]') ?? false)
                  const isNoShow = v.confirmStatus === 'NO_SHOW'
                  const canEdit = isAdmin || v.user?.id === myId
                  return (
                    <tr key={v.id} className="border-t">
                      <td className="px-4 py-2.5 align-top">
                        {idx === 0 && (
                          <>
                            <div className="font-semibold">{u.name}</div>
                            <div className="text-xs text-muted-foreground">{u.position || '-'}</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums">
                        {isUnknown ? '시간미정' : t.hhmm}
                        {v.confirmStatus === 'CHANGED' && v.previousDate && (
                          <div className="text-[11px] text-sky-600 mt-0.5">
                            전 {kstHoursMinutes(v.previousDate).hhmm}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('font-medium', isNoShow && 'line-through text-rose-500')}>
                          {v.customer.name || v.customer.phone}
                        </span>
                        {v.customer.assignedSite && (
                          <span className="ml-2 text-xs text-muted-foreground">· {v.customer.assignedSite}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <VBadge
                          size="sm"
                          status={v.confirmStatus}
                          onClick={() => canEdit && onToggleV(v)}
                          disabled={!canEdit}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {idx === 0 && (
                          <div className="flex items-center justify-end gap-1">
                            <Badge className={cn('rounded-full px-2 py-0.5 text-xs', teamBadgeStyle(list.length))}>
                              {list.length}팀
                            </Badge>
                          </div>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => onDelete(v)}
                            className="ml-2 text-gray-400 hover:text-rose-500"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
