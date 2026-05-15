'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Globe, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePolling } from '@/hooks/use-polling'
import { rankLabel } from '@/lib/utils/rank'

interface LeaderboardRow {
  rank: number
  userId: string
  userName: string
  department: string | null
  callCount: number
  publicClaimCount: number
  totalScore: number
}

interface LeaderboardData {
  rankings: LeaderboardRow[]
  myRank: LeaderboardRow | null
}

interface PublicDbStats {
  remaining: number
  todayCalls: number
}

export function PublicDbMini() {
  const router = useRouter()
  const { data: session } = useSession()
  const myId = session?.user?.id
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [stats, setStats] = useState<PublicDbStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        fetch('/api/leaderboard?period=week', { cache: 'no-store' }),
        fetch('/api/public-db/stats', { cache: 'no-store' }),
      ])
      const [rJson, sJson] = await Promise.all([rRes.json(), sRes.json()])
      if (rJson.success) setData(rJson.data as LeaderboardData)
      if (sJson.success) setStats(sJson.data as PublicDbStats)
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  usePolling(fetchAll, 60_000) // 1 min

  // 공개DB 활동 기준 정렬: publicClaimCount DESC, callCount DESC
  const sorted = (data?.rankings ?? [])
    .slice()
    .sort((a, b) => {
      if (b.publicClaimCount !== a.publicClaimCount) return b.publicClaimCount - a.publicClaimCount
      return b.callCount - a.callCount
    })
    // 공개DB 전환/통화 둘 다 0인 직원 제외
    .filter((r) => r.publicClaimCount > 0 || r.callCount > 0)

  const top = sorted.slice(0, 5)
  const me = sorted.find((r) => r.userId === myId)
  const myRankInSorted = me ? sorted.findIndex((r) => r.userId === myId) + 1 : 0
  const meInTop = me && top.find((r) => r.userId === myId)

  return (
    <Card className="flex flex-col">
      <CardHeader className="bg-blue-50 border-b py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5 text-blue-600" />
            공개DB 활동 순위
          </CardTitle>
          <span className="text-xs text-muted-foreground">이번 주</span>
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-4 flex-1">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : top.length === 0 ? (
          <div className="py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-blue-50/50 p-3 text-center">
                <div className="text-[11px] text-muted-foreground">잔여 공개DB</div>
                <div className="mt-1">
                  <span className="text-2xl font-bold text-blue-700 tabular-nums">
                    {stats?.remaining ?? '—'}
                  </span>
                  <span className="ml-1 text-xs text-muted-foreground">팀</span>
                </div>
              </div>
              <div className="rounded-lg border bg-emerald-50/50 p-3 text-center">
                <div className="text-[11px] text-muted-foreground">오늘 전체 통화</div>
                <div className="mt-1">
                  <span className="text-2xl font-bold text-emerald-700 tabular-nums">
                    {stats?.todayCalls ?? '—'}
                  </span>
                  <span className="ml-1 text-xs text-muted-foreground">콜</span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              이번 주 활동 기록은 아직 없습니다.
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-1">
              {top.map((row, idx) => {
                const displayRank = idx + 1
                const isMe = row.userId === myId
                return (
                  <li
                    key={row.userId}
                    className={cn(
                      'flex items-center justify-between rounded px-2 py-1.5',
                      isMe && 'bg-blue-50 border border-blue-200'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 text-center text-sm shrink-0">
                        {rankLabel(displayRank)}
                      </span>
                      <span className="font-medium truncate text-sm">{row.userName}</span>
                      {row.department && (
                        <span className="hidden md:inline text-xs text-muted-foreground truncate">
                          {row.department}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs tabular-nums shrink-0">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-muted-foreground">공개DB 전환</span>
                        <span className="font-semibold text-blue-700">{row.publicClaimCount}</span>
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="text-muted-foreground">통화</span>
                        <span className="font-semibold text-emerald-700">{row.callCount}</span>
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 pt-3 border-t text-sm">
              {me ? (
                meInTop ? (
                  <span className="text-blue-700 font-medium">🔥 상위권 진입 중!</span>
                ) : (
                  <span>
                    내 활동:{' '}
                    <span className="font-semibold text-blue-700">공개DB 전환 {me.publicClaimCount}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="font-semibold text-emerald-700">통화 {me.callCount}</span>
                    <span className="ml-1 text-muted-foreground">({myRankInSorted}위)</span>
                  </span>
                )
              ) : (
                <span className="text-muted-foreground">이번 주 활동 기록 없음</span>
              )}
            </div>
          </>
        )}
      </CardContent>
      {stats && top.length > 0 && (
        <div className="border-t bg-gray-50/50 px-4 py-2 text-xs text-muted-foreground flex items-center justify-between gap-2">
          <span>
            잔여 공개DB <span className="font-semibold text-blue-700 tabular-nums">{stats.remaining}</span>
            <span className="ml-0.5">팀</span>
          </span>
          <span>
            오늘 전체 통화 <span className="font-semibold text-emerald-700 tabular-nums">{stats.todayCalls}</span>
            <span className="ml-0.5">콜</span>
          </span>
        </div>
      )}
      <div className="px-3 pb-3 pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between"
          onClick={() => router.push('/dashboard/customers?publicDb=true')}
          type="button"
        >
          공개DB 전체
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  )
}
