import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buildDailyVisitBriefing } from '@/lib/briefing/daily-visits'
import { CopyBriefingButton } from '@/components/briefing/CopyBriefingButton'

export const dynamic = 'force-dynamic'

export default async function BriefingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/auth/signin')
  // 전 직원 열람 가능 (승인 대기자만 제외)
  if (session.user.role === 'PENDING') redirect('/dashboard')

  const { date } = await searchParams
  const briefing = date
    ? await buildDailyVisitBriefing(date)
    : await buildDailyVisitBriefing()

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">당일 방문 보고</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {briefing.headerLabel} · 금일 방문 {briefing.totalTeams}팀
          </p>
        </div>
        <CopyBriefingButton text={briefing.text} />
      </div>

      <Card className="border-blue-100 bg-blue-50/40">
        <CardContent className="p-3 md:p-4 text-xs md:text-sm text-blue-900">
          아래 내용을 <span className="font-semibold">[전체 복사]</span> 후 카톡 단체방에
          붙여넣어 주세요. 방문 데이터는 예약방문 스케줄에 등록된 오늘 방문을 기준으로 합니다.
        </CardContent>
      </Card>

      {/* 카톡 붙여넣기용 원문 미리보기 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">카톡 메시지 미리보기</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap break-words rounded-md bg-gray-50 p-4 text-sm leading-relaxed font-sans">
            {briefing.text}
          </pre>
        </CardContent>
      </Card>

      {/* 직원별 상세 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">직원별 방문 현황</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {briefing.rows.length === 0 && (
            <p className="text-sm text-muted-foreground">표시할 직원이 없습니다.</p>
          )}
          {briefing.rows.map((r) => (
            <div key={r.id} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
              <div>
                <div className="font-semibold">
                  {r.name} <span className="text-sm font-normal text-muted-foreground">{r.position}</span>
                </div>
                {r.count > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {r.visits.map((v, i) => (
                      <li key={i} className="text-muted-foreground">
                        {v.timeLabel} · {v.customerName}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 text-sm text-muted-foreground">방문 없음</div>
                )}
              </div>
              <Badge variant={r.count > 0 ? 'default' : 'secondary'} className="shrink-0">
                {r.count}팀
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
