'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ChevronLeft, ChevronRight, Plus, RotateCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { VBadge, cycleConfirm } from '@/components/visit-board/VBadge'
import { usePolling } from '@/hooks/use-polling'
import type { BoardData, BoardVisit, CustomerHit } from '@/components/visit-board/types'
import {
  ADMIN_ROLES,
  SLOTS,
  formatDateLabel,
  kstHoursMinutes,
  shiftDateKey,
  teamBadgeStyle,
  todayKstKey,
} from '@/components/visit-board/utils'

export default function VisitBoardPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [dateKey, setDateKey] = useState<string>(() => shiftDateKey(todayKstKey(), 1)) // 기본: 내일
  const [board, setBoard] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [addingForUser, setAddingForUser] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState<CustomerHit[]>([])
  const [picked, setPicked] = useState<CustomerHit | null>(null)
  const [newTime, setNewTime] = useState<string>('14:00')
  const [timeUnknown, setTimeUnknown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const role = (session?.user?.role as string | undefined) ?? ''
  const isAdmin = ADMIN_ROLES.has(role)
  const myId = session?.user?.id

  const fetchBoard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/visit-board?date=${dateKey}`, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok && json.success) {
        setBoard(json.data as BoardData)
      } else {
        toast({ title: '불러오기 실패', description: json.error || '재시도 해주세요.', variant: 'destructive' })
      }
    } catch {
      toast({ title: '네트워크 오류', description: '잠시 후 다시 시도해주세요.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [dateKey, toast])

  usePolling(fetchBoard, 60_000)

  // 고객 검색 디바운스
  useEffect(() => {
    if (!addingForUser) return
    if (!search.trim()) {
      setHits([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (/^\d+$/.test(search.trim())) params.set('query', search.trim())
        else params.set('name', search.trim())
        params.set('viewAll', 'true')
        const res = await fetch(`/api/customers?${params.toString()}`)
        const json = await res.json()
        const list = (json.data || json.customers || []) as Array<{
          id: string
          name: string | null
          phone: string
          assignedSite: string | null
        }>
        setHits(list.slice(0, 8).map((c) => ({ id: c.id, name: c.name, phone: c.phone, assignedSite: c.assignedSite })))
      } catch {
        setHits([])
      }
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, addingForUser])

  const visitsByUser = useMemo(() => {
    const map = new Map<string, BoardVisit[]>()
    board?.users.forEach((u) => map.set(u.id, []))
    board?.visits.forEach((v) => {
      if (!v.userId) return
      if (!map.has(v.userId)) map.set(v.userId, [])
      map.get(v.userId)!.push(v)
    })
    return map
  }, [board])

  const totalVisits = board?.visits.length ?? 0

  const handleToggleV = async (visit: BoardVisit) => {
    const next = cycleConfirm(visit.confirmStatus)
    // optimistic
    setBoard((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        visits: prev.visits.map((v) => (v.id === visit.id ? { ...v, confirmStatus: next } : v)),
      }
    })
    try {
      const res = await fetch(`/api/visit-board/${visit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmStatus: next }),
      })
      if (!res.ok) throw new Error('failed')
      fetchBoard()
    } catch {
      toast({ title: '상태 변경 실패', variant: 'destructive' })
      fetchBoard()
    }
  }

  const handleChangeTime = async (visit: BoardVisit, newHHmm: string) => {
    const visitDate = `${dateKey}T${newHHmm}`
    try {
      const res = await fetch(`/api/visit-board/${visit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitDate }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'failed')
      }
      toast({ title: '시간이 변경되었습니다', description: '파란 V로 자동 표시됩니다.' })
      fetchBoard()
    } catch (e) {
      toast({ title: '시간 변경 실패', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const handleDelete = async (visit: BoardVisit) => {
    if (!confirm(`${visit.customer.name || visit.customer.phone} 방문을 삭제할까요?`)) return
    try {
      const res = await fetch(`/api/visit-board/${visit.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      toast({ title: '삭제되었습니다' })
      fetchBoard()
    } catch {
      toast({ title: '삭제 실패', variant: 'destructive' })
    }
  }

  const handleAdd = async (targetUserId: string) => {
    if (!picked) {
      toast({ title: '고객을 선택해주세요', variant: 'destructive' })
      return
    }
    try {
      const payload: Record<string, unknown> = {
        customerId: picked.id,
        assigneeId: targetUserId,
        location: picked.assignedSite || '온시아',
      }
      if (timeUnknown) payload.visitDateOnly = dateKey
      else payload.visitDate = `${dateKey}T${newTime}`

      const res = await fetch('/api/visit-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'failed')
      toast({ title: '방문이 추가되었습니다' })
      setAddingForUser(null)
      setSearch('')
      setHits([])
      setPicked(null)
      setTimeUnknown(false)
      setNewTime('14:00')
      fetchBoard()
    } catch (e) {
      toast({ title: '추가 실패', description: (e as Error).message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">예약방문 스케줄</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDateLabel(dateKey)} · 온시아
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDateKey(shiftDateKey(dateKey, -1))}>
            <ChevronLeft className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">전날</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDateKey(todayKstKey())}>오늘</Button>
          <Button variant="outline" size="sm" onClick={() => setDateKey(shiftDateKey(todayKstKey(), 1))}>내일</Button>
          <Input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            className="h-9 w-[140px]"
          />
          <Button variant="outline" size="sm" onClick={() => setDateKey(shiftDateKey(dateKey, 1))}>
            <span className="mr-1 hidden sm:inline">다음날</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchBoard} disabled={loading} title="새로고침">
            <RotateCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* V 표시 안내 */}
      <Card className="border-blue-100 bg-blue-50/40">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs md:text-sm">
            <div className="font-semibold text-blue-900 mr-1">V 표시 의미</div>
            <div className="flex items-center gap-1.5">
              <VBadge size="sm" status={null} onClick={() => {}} disabled />
              <span className="text-muted-foreground">미체크</span>
            </div>
            <span className="text-gray-300">→</span>
            <div className="flex items-center gap-1.5">
              <VBadge size="sm" status="UNCHANGED" onClick={() => {}} disabled />
              <span><span className="font-medium text-emerald-700">변함없음</span> · 예약대로 진행</span>
            </div>
            <span className="text-gray-300">→</span>
            <div className="flex items-center gap-1.5">
              <VBadge size="sm" status="CHANGED" onClick={() => {}} disabled />
              <span><span className="font-medium text-sky-700">변동됨</span> · 시간 변경</span>
            </div>
            <span className="text-gray-300">→</span>
            <div className="flex items-center gap-1.5">
              <VBadge size="sm" status="NO_SHOW" onClick={() => {}} disabled />
              <span><span className="font-medium text-rose-600">방문 깨짐</span> · 안옴 (취소선)</span>
            </div>
          </div>
          <div className="mt-2 text-[11px] md:text-xs text-muted-foreground">
            V 버튼을 클릭할 때마다 위 순서대로 상태가 바뀝니다. 본인 방문은 직원이 직접, 다른 직원 방문은 관리자만 변경 가능.
          </div>
        </CardContent>
      </Card>

      {/* 보드 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium w-[160px]">담당자</th>
                  <th className="text-left px-4 py-3 font-medium w-[140px]">시간</th>
                  <th className="text-left px-4 py-3 font-medium">고객</th>
                  <th className="text-center px-4 py-3 font-medium w-[110px]">변동사항</th>
                  <th className="text-right px-4 py-3 font-medium w-[110px]">팀수</th>
                </tr>
              </thead>
              <tbody>
                {board?.users.map((u) => {
                  const visits = visitsByUser.get(u.id) || []
                  const canEditForUser = isAdmin || u.id === myId
                  return (
                    <tr key={u.id} className="border-t align-top">
                      <td className="px-4 py-4">
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.position || '-'}</div>
                        {canEditForUser && (
                          <button
                            className="mt-2 inline-flex items-center text-xs text-blue-600 hover:underline"
                            onClick={() => {
                              setAddingForUser(addingForUser === u.id ? null : u.id)
                              setSearch('')
                              setHits([])
                              setPicked(null)
                              setTimeUnknown(false)
                              setNewTime('14:00')
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" /> 방문 추가
                          </button>
                        )}
                      </td>
                      <td colSpan={3} className="px-4 py-4">
                        {visits.length === 0 && addingForUser !== u.id && (
                          <span className="text-muted-foreground">방문 없음</span>
                        )}
                        <div className="space-y-2">
                          {visits.map((v) => {
                            const t = kstHoursMinutes(v.visitDate)
                            const isUnknownTime = !t.hasTime || (v.memo?.includes('[시간 미정]') ?? false)
                            const isNoShow = v.confirmStatus === 'NO_SHOW'
                            const isChanged = v.confirmStatus === 'CHANGED'
                            const canEditThis = isAdmin || v.user?.id === myId
                            return (
                              <div key={v.id} className="grid grid-cols-[140px_1fr_110px] items-center gap-3">
                                <div className="font-semibold tracking-tight">
                                  {canEditThis ? (
                                    <Select
                                      value={isUnknownTime ? '' : t.hhmm}
                                      onValueChange={(val) => handleChangeTime(v, val)}
                                    >
                                      <SelectTrigger className="h-8 w-[110px]">
                                        <SelectValue placeholder={isUnknownTime ? '시간 미정' : t.hhmm} />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[280px]">
                                        {SLOTS.map((s) => (
                                          <SelectItem key={s} value={s}>
                                            {s}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span>{isUnknownTime ? '시간 미정' : t.hhmm}</span>
                                  )}
                                  {isChanged && v.previousDate && (
                                    <div className="text-[11px] text-sky-600 mt-0.5">
                                      변경 전: {kstHoursMinutes(v.previousDate).hhmm}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <span className={cn('font-medium', isNoShow && 'line-through text-rose-500')}>
                                    {v.customer.name || v.customer.phone}
                                  </span>
                                  {v.customer.assignedSite && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      · {v.customer.assignedSite}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                  <VBadge
                                    status={v.confirmStatus}
                                    onClick={() => canEditThis && handleToggleV(v)}
                                    disabled={!canEditThis}
                                  />
                                  {canEditThis && (
                                    <button
                                      onClick={() => handleDelete(v)}
                                      className="text-gray-400 hover:text-rose-500"
                                      title="삭제"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}

                          {/* 인라인 추가 폼 */}
                          {addingForUser === u.id && (
                            <div className="border rounded-md p-3 bg-blue-50/40 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  autoFocus
                                  placeholder="고객 이름 또는 번호 검색"
                                  value={search}
                                  onChange={(e) => setSearch(e.target.value)}
                                  className="h-8 w-[200px]"
                                />
                                {!timeUnknown && (
                                  <Select value={newTime} onValueChange={setNewTime}>
                                    <SelectTrigger className="h-8 w-[110px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[280px]">
                                      {SLOTS.map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                <label className="text-xs inline-flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={timeUnknown}
                                    onChange={(e) => setTimeUnknown(e.target.checked)}
                                  />
                                  시간 미정
                                </label>
                                <Button size="sm" onClick={() => handleAdd(u.id)} disabled={!picked}>
                                  추가
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setAddingForUser(null)
                                    setPicked(null)
                                    setSearch('')
                                    setHits([])
                                  }}
                                >
                                  취소
                                </Button>
                              </div>
                              {picked ? (
                                <div className="text-sm">
                                  선택됨: <span className="font-semibold">{picked.name || '(이름없음)'}</span>{' '}
                                  <span className="text-muted-foreground">{picked.phone}</span>
                                  <button className="ml-2 text-xs text-blue-600 hover:underline" onClick={() => setPicked(null)}>
                                    바꾸기
                                  </button>
                                </div>
                              ) : hits.length > 0 ? (
                                <ul className="max-h-40 overflow-y-auto rounded-md border bg-white divide-y">
                                  {hits.map((h) => (
                                    <li key={h.id}>
                                      <button
                                        className="w-full text-left px-3 py-2 hover:bg-gray-50"
                                        onClick={() => {
                                          setPicked(h)
                                          setSearch('')
                                          setHits([])
                                        }}
                                      >
                                        <span className="font-medium">{h.name || '(이름없음)'}</span>
                                        <span className="ml-2 text-xs text-muted-foreground">{h.phone}</span>
                                        {h.assignedSite && (
                                          <span className="ml-2 text-[11px] text-blue-600">· {h.assignedSite}</span>
                                        )}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : search.trim() ? (
                                <div className="text-xs text-muted-foreground">검색 결과 없음</div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right align-top">
                        <Badge className={cn('rounded-full px-3 py-1 text-sm font-semibold', teamBadgeStyle(visits.length))}>
                          {visits.length}팀
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
                {!board && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      불러오는 중...
                    </td>
                  </tr>
                )}
                {board && board.users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      활성 직원이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-muted-foreground" colSpan={4}>총 방문</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-2xl font-bold">{totalVisits}</span>
                    <span className="ml-1 text-base text-muted-foreground">팀</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-right text-[11px] text-muted-foreground">60초마다 자동 새로고침</div>
    </div>
  )
}
