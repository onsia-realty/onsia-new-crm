import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/contracts/[id] - 계약 상태 변경
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, memo } = body;

    const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session.user.role);

    // 계약 조회
    const contract = await prisma.interestCard.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            assignedUserId: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: '계약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 체크: 관리자이거나 담당자만 수정 가능
    if (!isAdmin && contract.customer?.assignedUserId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 업데이트
    const updatedContract = await prisma.interestCard.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(memo !== undefined && { memo }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedContract,
    });
  } catch (error) {
    console.error('Failed to update contract:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update contract' },
      { status: 500 }
    );
  }
}

// DELETE /api/contracts/[id] - 계약 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session.user.role);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    await prisma.interestCard.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '계약이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Failed to delete contract:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete contract' },
      { status: 500 }
    );
  }
}
