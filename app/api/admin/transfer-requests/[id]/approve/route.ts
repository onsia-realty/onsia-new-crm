import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/admin/transfer-requests/[id]/approve - 담당자 변경 승인/반려
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ADMIN, HEAD만 승인 가능
    if (!['ADMIN', 'HEAD'].includes(session.user.role)) {
      return NextResponse.json(
        { error: '승인 권한이 없습니다.' },
        { status: 403 }
      )
    }

    const { status, rejectedReason } = await req.json()

    // 유효한 상태값인지 확인
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태입니다.' },
        { status: 400 }
      )
    }

    // 반려 시 사유 필수
    if (status === 'REJECTED' && !rejectedReason) {
      return NextResponse.json(
        { error: '반려 사유를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 변경 요청 조회
    const transferRequest = await prisma.transferRequest.findUnique({
      where: { id },
      include: { customer: true }
    })

    if (!transferRequest) {
      return NextResponse.json(
        { error: '변경 요청을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 이미 처리된 요청인지 확인
    if (transferRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: '이미 처리된 요청입니다.' },
        { status: 400 }
      )
    }

    // 트랜잭션으로 처리: 변경 요청 업데이트 + 고객 배정 변경
    const result = await prisma.$transaction(async (tx) => {
      // 1. 변경 요청 상태 업데이트
      const updatedRequest = await tx.transferRequest.update({
        where: { id },
        data: {
          status,
          approvedById: session.user.id,
          approvedAt: new Date(),
          rejectedReason: status === 'REJECTED' ? rejectedReason : null
        },
        include: {
          customer: { select: { id: true, name: true } },
          fromUser: { select: { id: true, name: true } },
          toUser: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } }
        }
      })

      // 2. 승인된 경우 고객의 담당자 변경
      if (status === 'APPROVED') {
        await tx.customer.update({
          where: { id: transferRequest.customerId },
          data: {
            assignedUserId: transferRequest.toUserId,
            assignedAt: new Date()
          }
        })
      }

      return updatedRequest
    })

    return NextResponse.json({
      success: true,
      message: status === 'APPROVED' ? '담당자 변경이 승인되었습니다.' : '담당자 변경 요청이 반려되었습니다.',
      transferRequest: result
    })
  } catch (error) {
    console.error('Failed to process transfer request:', error)
    return NextResponse.json(
      { error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
