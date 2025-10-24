'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { ChevronLeft, Check, X, Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface TransferRequest {
  id: string
  customer: {
    id: string
    name: string
    phone: string
  }
  fromUser: {
    id: string
    name: string
    role: string
  }
  toUser: {
    id: string
    name: string
    role: string
  }
  requestedBy: {
    id: string
    name: string
  }
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approvedBy?: {
    id: string
    name: string
  } | null
  approvedAt?: string | null
  rejectedReason?: string | null
  createdAt: string
}

export default function TransferRequestsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [selectedRequest, setSelectedRequest] = useState<TransferRequest | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const pageSize = 10

  const fetchRequests = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/transfer-requests?status=${statusFilter}&page=${page}&limit=${pageSize}`
      )
      if (!response.ok) throw new Error('요청 조회 실패')

      const result = await response.json()
      setRequests(result.data || [])
      setTotal(result.pagination?.total || 0)
    } catch {
      toast({
        title: '오류',
        description: '요청 목록을 불러오지 못했습니다.',
        variant: 'destructive'
      })
    }
  }, [page, statusFilter, toast])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleApprove = async (requestId: string) => {
    try {
      setProcessingId(requestId)
      const response = await fetch(`/api/admin/transfer-requests/${requestId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' })
      })

      if (!response.ok) throw new Error('승인 실패')

      toast({
        title: '성공',
        description: '담당자 변경이 승인되었습니다.'
      })

      setSelectedRequest(null)
      fetchRequests()
    } catch (error) {
      console.error('Failed to approve:', error)
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '승인 처리 중 오류가 발생했습니다.',
        variant: 'destructive'
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (requestId: string) => {
    if (!rejectionReason.trim()) {
      toast({
        title: '오류',
        description: '반려 사유를 입력해주세요.',
        variant: 'destructive'
      })
      return
    }

    try {
      setProcessingId(requestId)
      const response = await fetch(`/api/admin/transfer-requests/${requestId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', rejectedReason: rejectionReason })
      })

      if (!response.ok) throw new Error('반려 실패')

      toast({
        title: '성공',
        description: '담당자 변경 요청이 반려되었습니다.'
      })

      setSelectedRequest(null)
      setRejectionReason('')
      fetchRequests()
    } catch (error) {
      console.error('Failed to reject:', error)
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '반려 처리 중 오류가 발생했습니다.',
        variant: 'destructive'
      })
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-800">대기 중</Badge>
      case 'APPROVED':
        return <Badge variant="outline" className="bg-green-50 border-green-200 text-green-800">승인됨</Badge>
      case 'REJECTED':
        return <Badge variant="outline" className="bg-red-50 border-red-200 text-red-800">반려됨</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-600" />
      case 'APPROVED':
        return <Check className="w-5 h-5 text-green-600" />
      case 'REJECTED':
        return <X className="w-5 h-5 text-red-600" />
      default:
        return null
    }
  }

  const pages = Math.ceil(total / pageSize)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin')}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              돌아가기
            </Button>
            <h1 className="text-2xl font-bold">담당자 변경 요청</h1>
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="container mx-auto px-4 py-6">
        {/* 필터 */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Label className="font-medium">상태:</Label>
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value)
                setPage(1)
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">대기 중</SelectItem>
                  <SelectItem value="APPROVED">승인됨</SelectItem>
                  <SelectItem value="REJECTED">반려됨</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto text-sm text-gray-600">
                총 {total}개의 요청
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 요청 목록 */}
        {requests.length > 0 ? (
          <>
            <div className="space-y-3">
              {requests.map((request) => (
                <Card key={request.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        {/* 기본 정보 */}
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-lg">{request.customer.name}</p>
                            <p className="text-sm text-gray-600">📱 {request.customer.phone}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(request.status)}
                            {getStatusBadge(request.status)}
                          </div>
                        </div>

                        {/* 담당자 변경 정보 */}
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">현재 담당자</p>
                              <p className="font-medium">{request.fromUser.name}</p>
                              <p className="text-xs text-gray-500">{request.fromUser.role}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">변경 대상</p>
                              <p className="font-medium">{request.toUser.name}</p>
                              <p className="text-xs text-gray-500">{request.toUser.role}</p>
                            </div>
                          </div>
                        </div>

                        {/* 변경 사유 */}
                        <div>
                          <p className="text-sm text-gray-600 mb-1">변경 사유:</p>
                          <p className="text-sm">{request.reason}</p>
                        </div>

                        {/* 반려 사유 (반려된 경우) */}
                        {request.status === 'REJECTED' && request.rejectedReason && (
                          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                            <p className="text-sm font-medium text-red-900 mb-1">반려 사유:</p>
                            <p className="text-sm text-red-800">{request.rejectedReason}</p>
                          </div>
                        )}

                        {/* 요청자 및 일시 */}
                        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                          <span>요청자: {request.requestedBy.name}</span>
                          <span>{new Date(request.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</span>
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      {request.status === 'PENDING' && (
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => setSelectedRequest(request)}
                            disabled={processingId === request.id}
                          >
                            {processingId === request.id ? '처리 중...' : '승인'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => setSelectedRequest(request)}
                            disabled={processingId === request.id}
                          >
                            반려
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 페이지네이션 */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  disabled={page === 1}
                >
                  이전
                </Button>
                {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                  const pageNum = Math.max(1, page - 2) + i
                  if (pageNum > pages) return null
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(prev => Math.min(prev + 1, pages))}
                  disabled={page === pages}
                >
                  다음
                </Button>
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <p className="text-gray-500">
                {statusFilter === 'PENDING' ? '대기 중인' : statusFilter === 'APPROVED' ? '승인된' : '반려된'} 요청이 없습니다.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 승인/반려 다이얼로그 */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => {
        if (!open) {
          setSelectedRequest(null)
          setRejectionReason('')
        }
      }}>
        {selectedRequest && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>담당자 변경 요청 처리</DialogTitle>
              <DialogDescription>
                {selectedRequest.customer.name}님의 담당자 변경을 처리하시겠습니까?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p><span className="text-gray-600">고객:</span> <strong>{selectedRequest.customer.name}</strong> ({selectedRequest.customer.phone})</p>
                <p><span className="text-gray-600">현재 담당자:</span> <strong>{selectedRequest.fromUser.name}</strong></p>
                <p><span className="text-gray-600">변경 대상:</span> <strong>{selectedRequest.toUser.name}</strong></p>
                <p><span className="text-gray-600">변경 사유:</span> <strong>{selectedRequest.reason}</strong></p>
              </div>

              <div>
                <Label htmlFor="rejectionReason">반려 사유 (반려 선택 시만 필수)</Label>
                <Textarea
                  id="rejectionReason"
                  placeholder="반려 사유를 입력하세요..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRequest(null)
                  setRejectionReason('')
                }}
                disabled={processingId === selectedRequest.id}
              >
                취소
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleReject(selectedRequest.id)}
                disabled={processingId === selectedRequest.id || !rejectionReason.trim()}
              >
                {processingId === selectedRequest.id ? '처리 중...' : '반려'}
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleApprove(selectedRequest.id)}
                disabled={processingId === selectedRequest.id}
              >
                {processingId === selectedRequest.id ? '처리 중...' : '승인'}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
