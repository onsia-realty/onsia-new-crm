import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { checkPermission, createAuditLog } from '@/lib/auth/rbac';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 확인 - 고객 배분은 ADMIN, HEAD, TEAM_LEADER만 가능
    const canAllocate = await checkPermission('customers', 'allocate');
    if (!canAllocate) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { customerIds, toUserId, reason } = await request.json();

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: 'Invalid customer IDs' }, { status: 400 });
    }

    if (!toUserId) {
      return NextResponse.json({ error: 'Target user is required' }, { status: 400 });
    }

    // 트랜잭션으로 배분 처리
    const result = await prisma.$transaction(async (tx) => {
      // 기존 담당자 정보 조회
      const customers = await tx.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, assignedUserId: true },
      });

      // 고객 업데이트
      await tx.customer.updateMany({
        where: { id: { in: customerIds } },
        data: {
          assignedUserId: toUserId,
          assignedAt: new Date(),
        },
      });

      // 배분 기록 생성
      const allocations = await Promise.all(
        customers.map((customer) =>
          tx.customerAllocation.create({
            data: {
              customerId: customer.id,
              fromUserId: customer.assignedUserId,
              toUserId: toUserId,
              allocatedById: session.user!.id,
              reason: reason || null,
            },
          })
        )
      );

      return allocations;
    });

    // 감사 로그
    await createAuditLog(
      session.user.id,
      'ALLOCATE_CUSTOMERS',
      'Customer',
      undefined,
      {
        customerCount: customerIds.length,
        toUserId,
        reason,
      },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return NextResponse.json({
      success: true,
      allocated: result.length,
    });
  } catch (error) {
    console.error('Failed to allocate customers:', error);
    return NextResponse.json(
      { error: 'Failed to allocate customers' },
      { status: 500 }
    );
  }
}