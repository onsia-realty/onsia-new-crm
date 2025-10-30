import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit';

// PATCH /api/visit-schedules/[id] - 방문 일정 상태 업데이트
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, memo, completedAt } = body;

    // 방문 일정 존재 확인
    const visitSchedule = await prisma.visitSchedule.findUnique({
      where: { id },
      include: {
        customer: true,
        user: true
      }
    });

    if (!visitSchedule) {
      return NextResponse.json(
        { error: '방문 일정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 체크: 본인 일정이거나 관리자/본부장만 수정 가능
    const isAdmin = ['ADMIN', 'HEAD'].includes(session.user.role);
    const isOwner = visitSchedule.userId === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 상태 업데이트 데이터 준비
    interface UpdateData {
      status?: string;
      memo?: string;
      completedAt?: Date | null;
    }

    const updateData: UpdateData = {};

    if (status) {
      updateData.status = status;

      // CHECKED 상태로 변경 시 completedAt 자동 설정
      if (status === 'CHECKED' && !visitSchedule.completedAt) {
        updateData.completedAt = new Date();
      }

      // SCHEDULED로 되돌릴 경우 completedAt 제거
      if (status === 'SCHEDULED') {
        updateData.completedAt = null;
      }
    }

    if (memo !== undefined) {
      updateData.memo = memo;
    }

    if (completedAt !== undefined) {
      updateData.completedAt = completedAt ? new Date(completedAt) : null;
    }

    // 방문 일정 업데이트
    const updatedSchedule = await prisma.visitSchedule.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // 감사 로그 기록
    await createAuditLog({
      userId: session.user.id,
      action: 'UPDATE_VISIT_SCHEDULE',
      entity: 'VisitSchedule',
      entityId: id,
      changes: {
        oldStatus: visitSchedule.status,
        newStatus: status,
        customerName: visitSchedule.customer.name
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });

    return NextResponse.json({
      success: true,
      data: updatedSchedule
    });
  } catch (error) {
    console.error('Failed to update visit schedule:', error);
    return NextResponse.json(
      { success: false, error: '방문 일정 업데이트에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/visit-schedules/[id] - 방문 일정 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 방문 일정 존재 확인
    const visitSchedule = await prisma.visitSchedule.findUnique({
      where: { id },
      include: {
        customer: true
      }
    });

    if (!visitSchedule) {
      return NextResponse.json(
        { error: '방문 일정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 체크: 본인 일정이거나 관리자/본부장만 삭제 가능
    const isAdmin = ['ADMIN', 'HEAD'].includes(session.user.role);
    const isOwner = visitSchedule.userId === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 방문 일정 삭제
    await prisma.visitSchedule.delete({
      where: { id }
    });

    // 감사 로그 기록
    await createAuditLog({
      userId: session.user.id,
      action: 'DELETE_VISIT_SCHEDULE',
      entity: 'VisitSchedule',
      entityId: id,
      changes: {
        customerName: visitSchedule.customer.name,
        visitDate: visitSchedule.visitDate
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });

    return NextResponse.json({
      success: true,
      message: '방문 일정이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('Failed to delete visit schedule:', error);
    return NextResponse.json(
      { success: false, error: '방문 일정 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
