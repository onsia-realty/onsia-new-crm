'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle2, Loader2, Clock, User, TrendingUp, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface StaffMember {
  id: string
  name: string
  email: string | null
  role: string
  phone: string
  todayCount: number
  baseLimit: number
  approvalCount: number
  currentLimit: number
  exceeded: boolean
}

export default function ApprovalsPage() {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const fetchStaffMembers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/approve-daily-limit')
      const result = await response.json()

      if (result.success) {
        // 제한 초과한 직원만 표시
        setStaffMembers(result.data || [])
      } else {
        toast.error('직원 목록 조회 실패')
      }
    } catch {
      toast.error('직원 목록 조회 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaffMembers()
    // 30초마다 자동 갱신
    const interval = setInterval(fetchStaffMembers, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleApprove = async (userId: string, userName: string) => {
    setProcessingIds(prev => new Set(prev).add(userId))

    try {
      const response = await fetch('/api/admin/approve-daily-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`${userName}님의 일일 제한이 해제되었습니다`)
        await fetchStaffMembers()
      } else {
        toast.error(result.error || '승인 처리 실패')
      }
    } catch {
      toast.error('승인 처리 중 오류가 발생했습니다')
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  const pendingApprovals = staffMembers.filter(s => s.exceeded)
  const allStaffWithApprovals = staffMembers.filter(s => s.approvalCount > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">일일 등록 제한 승인</h1>
        <p className="text-muted-foreground mt-2">
          50건 등록 제한을 초과한 직원의 제한을 해제하세요
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">승인 대기</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovals.length}명</div>
            <p className="text-xs text-muted-foreground">
              제한 초과 후 승인 대기 중
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">승인 받은 직원</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allStaffWithApprovals.length}명</div>
            <p className="text-xs text-muted-foreground">
              오늘 +50건 이상 승인받음
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 제한 초과</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staffMembers.length}명</div>
            <p className="text-xs text-muted-foreground">
              50건 이상 등록한 직원
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 승인 대기 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            승인 대기 중 ({pendingApprovals.length}명)
          </CardTitle>
          <CardDescription>
            아래 직원들의 일일 등록 제한을 +50건 증가시키세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">로딩 중...</span>
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>승인 대기 중인 직원이 없습니다</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>직원명</TableHead>
                    <TableHead>직급</TableHead>
                    <TableHead>연락처</TableHead>
                    <TableHead className="text-center">오늘 등록</TableHead>
                    <TableHead className="text-center">현재 제한</TableHead>
                    <TableHead className="text-center">승인 횟수</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingApprovals.map((staff) => {
                    const isProcessing = processingIds.has(staff.id)
                    return (
                      <TableRow key={staff.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {staff.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{staff.role}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {staff.phone}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold text-lg text-orange-600">
                            {staff.todayCount}건
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">
                            {staff.currentLimit}건
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={staff.approvalCount > 0 ? "default" : "secondary"}>
                            {staff.approvalCount}회 (+{staff.approvalCount * 50}건)
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(staff.id, staff.name)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                +50건 승인
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 승인 받은 직원 목록 */}
      {allStaffWithApprovals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              승인 받은 직원 ({allStaffWithApprovals.length}명)
            </CardTitle>
            <CardDescription>
              오늘 +50건 이상 승인받은 직원 목록
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>직원명</TableHead>
                    <TableHead>직급</TableHead>
                    <TableHead className="text-center">오늘 등록</TableHead>
                    <TableHead className="text-center">현재 제한</TableHead>
                    <TableHead className="text-center">승인 상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allStaffWithApprovals.map((staff) => (
                    <TableRow key={staff.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {staff.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{staff.role}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-lg">{staff.todayCount}건</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-green-600">{staff.currentLimit}건</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {staff.approvalCount}회 승인 (+{staff.approvalCount * 50}건)
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
