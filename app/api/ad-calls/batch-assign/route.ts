import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// POST /api/ad-calls/batch-assign - 광고 콜 번호 일괄 배분
const batchAssignSchema = z.object({
  adCallIds: z.array(z.string()).min(1),
  assignedUserId: z.string(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session.user.role || '');
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can assign ad calls' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = batchAssignSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error },
        { status: 400 }
      );
    }

    const { adCallIds, assignedUserId } = validationResult.data;

    // 배분 대상 직원이 존재하는지 확인
    const targetUser = await prisma.user.findUnique({
      where: { id: assignedUserId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    // 일괄 배분
    const result = await prisma.adCallNumber.updateMany({
      where: {
        id: {
          in: adCallIds,
        },
        status: 'PENDING', // PENDING 상태인 것만 배분 가능
      },
      data: {
        assignedUserId,
        assignedAt: new Date(),
        assignedById: session.user.id,
        status: 'ASSIGNED',
      },
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `${result.count}개의 광고 콜 번호를 ${targetUser.name}에게 배분했습니다.`,
    });
  } catch (error) {
    console.error('Failed to batch assign ad calls:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to batch assign ad calls' },
      { status: 500 }
    );
  }
}
