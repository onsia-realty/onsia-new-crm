'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

// 대시보드 홈에 노출되는 "당일 방문 보고" 진입 카드 (전 직원)
export function DailyVisitReportCard() {
  const [total, setTotal] = useState<number | null>(null)
  const [label, setLabel] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/briefing/daily-visits')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.success) return
        setTotal(j.data.totalTeams)
        setLabel(j.data.headerLabel)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Link href="/dashboard/briefing">
      <Card className="mb-6 cursor-pointer border-blue-100 bg-blue-50/40 transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5">
              <ClipboardList className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">📋 당일 방문 보고</div>
              <div className="text-sm text-muted-foreground">
                {label ? `${label} · ` : ''}오늘 방문 {total ?? '…'}팀 · 탭하여 카톡용 보고 보기
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
        </CardContent>
      </Card>
    </Link>
  )
}
