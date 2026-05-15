'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarCheck, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePolling } from '@/hooks/use-polling'
import { rankLabel } from '@/lib/utils/rank'

interface VisitRow {
  rank: number
  userId: string
  userName: string
  position: string | null
  department: string | null
  checked: number
  scheduled: number
  noShow: number
  total: number
}

export function WeeklyVisitMini() {
  const router = useRouter()
  const { data: session } = useSession()
  const myId = session?.user?.id
  const [rows, setRows] = useState<VisitRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/visits/weekly-leaderboard', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) setRows(json.data.rankings as VisitRow[])
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  usePolling(fetchData, 120_000) // 2 min

  const top = rows.slice(0, 5)
  const me = rows.find((r) => r.userId === myId)
  const meInTop = me && top.find((r) => r.userId === myId)

  return (
    <Card className="flex flex-col">
      <CardHeader className="bg-sky-50 border-b py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-5 w-5 text-sky-600" />
            이번 주 방문 순위
          </CardTitle>
          <span className="text-xs text-muted-foreground shrink-0">이번 주</span>
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-4 flex-1">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : top.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            이번 주 방문 기록이 아직 없습니다.
          </div>
        ) : (
          <>
            <ul className="space-y-1">
              {top.map((row, idx) => {
                const isMe = row.userId === myId
                return (
                  <li
                    key={row.userId}
                    className={cn(
                      'flex items-center justify-between rounded px-2 py-1.5',
                      isMe && 'bg-sky-50 border border-sky-200'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 text-center text-sm shrink-0">
                        {rankLabel(idx + 1)}
                      </span>
                      <span className="font-medium truncate text-sm">{row.userName}</span>
                    </div>
                    <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-200 ml-2 text-xs shrink-0">
                      {row.total}건
                    </Badge>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 pt-3 border-t text-sm">
              {me ? (
                meInTop ? (
                  <span className="text-sky-700 font-medium">🔥 상위권 진입 중!</span>
                ) : (
                  <span>
                    내 방문: <span className="font-semibold text-sky-700">{me.total}건</span>
                    <span className="ml-1 text-muted-foreground">({me.rank}위)</span>
                  </span>
                )
              ) : (
                <span className="text-muted-foreground">이번 주 방문 없음</span>
              )}
            </div>
          </>
        )}
      </CardContent>
      <div className="px-3 pb-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between"
          onClick={() => router.push('/dashboard/visit-board')}
          type="button"
        >
          방문 보드 열기
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  )
}
