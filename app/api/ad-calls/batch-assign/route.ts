import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// POST /api/ad-calls/batch-assign - 광고 콜 번호 일괄 배분
const batchAssignSchema = z.object({
  adCallIds: z.array(z.string()).min(1),
  assignedUserId: z.string(),
  autoRegisterCustomer: z.boolean().optional(), // 고객 자동 등록 여부
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

    const { adCallIds, assignedUserId, autoRegisterCustomer } = validationResult.data;

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

    // 배분할 광고 콜 조회
    const adCallsToAssign = await prisma.adCallNumber.findMany({
      where: {
        id: { in: adCallIds },
        status: 'PENDING',
      },
    });

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

    // 고객 자동 등록 옵션이 켜져 있으면 고객 등록
    let customersCreated = 0;
    if (autoRegisterCustomer && adCallsToAssign.length > 0) {
      for (const adCall of adCallsToAssign) {
        // 이미 해당 전화번호로 등록된 고객이 있는지 확인
        const existingCustomer = await prisma.customer.findFirst({
          where: {
            phone: adCall.phone,
            isDeleted: false,
          },
        });

        if (!existingCustomer) {
          // 새 고객 등록
          const memoText = adCall.notes
            ? `[광고콜] ${adCall.source || ''} / ${adCall.notes}`
            : `[광고콜 자동등록] ${adCall.source || ''} ${adCall.siteName || ''}`.trim();

          await prisma.customer.create({
            data: {
              phone: adCall.phone,
              name: '', // 이름은 나중에 입력
              source: 'AD', // 광고콜이므로 AD 타입으로 설정
              memo: memoText || null,
              assignedUserId: assignedUserId,
              assignedSite: adCall.siteName || null,
            },
          });
          customersCreated++;
        }
      }
    }

    const customerMessage = autoRegisterCustomer && customersCreated > 0
      ? ` (${customersCreated}명 고객 자동 등록)`
      : '';

    return NextResponse.json({
      success: true,
      count: result.count,
      customersCreated,
      message: `${result.count}개의 광고 콜 번호를 ${targetUser.name}에게 배분했습니다.${customerMessage}`,
    });
  } catch (error) {
    console.error('Failed to batch assign ad calls:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to batch assign ad calls' },
      { status: 500 }
    );
  }
}
