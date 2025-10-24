import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { toUserId, reason } = await req.json();

    if (!toUserId || !reason) {
      return NextResponse.json(
        { error: '담당자와 사유를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 고객 조회
    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      select: { id: true, assignedUserId: true, name: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: '고객을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!customer.assignedUserId) {
      return NextResponse.json(
        { error: '담당자가 지정되지 않은 고객입니다.' },
        { status: 400 }
      );
    }

    // 새로운 담당자 존재 여부 확인
    const newUser = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, name: true, role: true },
    });

    if (!newUser) {
      return NextResponse.json(
        { error: '담당자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 해당 담당자에게 배정되어 있으면 오류
    if (customer.assignedUserId === toUserId) {
      return NextResponse.json(
        { error: '이미 해당 담당자에게 배정되어 있습니다.' },
        { status: 400 }
      );
    }

    // 진행 중인 변경 요청이 있는지 확인
    const existingRequest = await prisma.transferRequest.findFirst({
      where: {
        customerId: params.id,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: '진행 중인 변경 요청이 있습니다.' },
        { status: 400 }
      );
    }

    // 변경 요청 생성
    const transferRequest = await prisma.transferRequest.create({
      data: {
        customerId: params.id,
        fromUserId: customer.assignedUserId,
        toUserId,
        requestedById: session.user.id,
        reason,
      },
      include: {
        customer: { select: { id: true, name: true } },
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: '담당자 변경 요청이 등록되었습니다.',
      transferRequest,
    });
  } catch (error) {
    console.error('Failed to create transfer request:', error);
    return NextResponse.json(
      { error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
