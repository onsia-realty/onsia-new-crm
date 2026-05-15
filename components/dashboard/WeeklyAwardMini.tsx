'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePolling } from '@/hooks/use-polling'
import { rankLabel } from '@/lib/utils/rank'

interface AwardRow {
  rank: number
  userId: string
  userName: string
  department: string | null
  totalCount: number
  conversionRate: number | null
  isMe: boolean
}

interface WeeklyAwardData {
  weekKey: string
  weekLabel: string
  rankings: AwardRow[]
  totalAwarded: number
}

export function WeeklyAwardMini() {
  const router = useRouter()
  const [data, setData] = useState<WeeklyAwardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/ad-calls/awards/weekly', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) setData(json.data as WeeklyAwardData)
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  usePolling(fetchData, 300_000) // 5 min

  const top = data?.rankings.slice(0, 5) ?? []
  const me = data?.rankings.find((r) => r.isMe)
  const meInTop = me && top.find((r) => r.userId === me.userId)

  return (
    <Card className="flex flex-col">
      <CardHeader className="bg-amber-50 border-b py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-amber-600" />
            이번 주 광고콜 시상
          </CardTitle>
          {data && (
            <span className="text-xs text-muted-foreground shrink-0">총 {data.totalAwarded}건</span>
          )}
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
          <div className="py-6 text-center text-sm text-muted-foreground">이번 주 시상이 아직 없습니다.</div>
        ) : (
          <>
            <ul className="space-y-1">
              {top.map((row) => (
                <li
                  key={row.userId}
                  className={cn(
                    'flex items-center justify-between rounded px-2 py-1.5',
                    row.isMe && 'bg-amber-50 border border-amber-200'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 text-center text-sm shrink-0">
                      {rankLabel(row.rank)}
                    </span>
                    <span className="font-medium truncate text-sm">{row.userName}</span>
                    {row.department && (
                      <span className="hidden md:inline text-xs text-muted-foreground truncate">
                        {row.department}
                      </span>
                    )}
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 ml-2 text-xs shrink-0">
                    {row.totalCount}건
                  </Badge>
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t text-sm">
              {me ? (
                meInTop ? (
                  <span className="text-amber-700 font-medium">🔥 상위권 진입 중!</span>
                ) : (
                  <>
                    내 시상: <span className="font-semibold text-amber-700">{me.totalCount}건</span>
                    <span className="ml-1 text-muted-foreground">({me.rank}위)</span>
                  </>
                )
              ) : (
                <span className="text-muted-foreground">이번 주 시상 미수령</span>
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
          onClick={() => router.push('/dashboard/leaderboard')}
          type="button"
        >
          시상 보드 열기
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  )
}
