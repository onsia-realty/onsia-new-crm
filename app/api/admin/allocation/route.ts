import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkPermission, createAuditLog } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';

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

    const { customerIds, toUserId, reason, assignedSite } = await request.json();

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: 'Invalid customer IDs' }, { status: 400 });
    }

    if (!toUserId) {
      return NextResponse.json({ error: 'Target user is required' }, { status: 400 });
    }

    // 대상 사용자가 실제로 존재하는지 확인
    const targetUser = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, name: true, role: true, isActive: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    if (!targetUser.isActive) {
      return NextResponse.json({ error: 'Target user is inactive' }, { status: 400 });
    }

    // 트랜잭션으로 배분 처리
    const result = await prisma.$transaction(async (tx) => {
      // 기존 담당자 정보 조회
      const customers = await tx.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, assignedUserId: true },
      });

      if (customers.length === 0) {
        throw new Error('No customers found with provided IDs');
      }

      // 고객 업데이트 (현장 정보 포함)
      await tx.customer.updateMany({
        where: { id: { in: customerIds } },
        data: {
          assignedUserId: toUserId,
          assignedAt: new Date(),
          ...(assignedSite !== undefined && { assignedSite: assignedSite || null }),
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
              allocatedById: session.user.id,
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
        toUserName: targetUser.name,
        reason,
        assignedSite,
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

    // 더 자세한 오류 정보 반환
    const errorMessage = error instanceof Error ? error.message : 'Failed to allocate customers';
    const errorDetails = error instanceof Error ? error.stack : undefined;

    console.error('Error details:', {
      message: errorMessage,
      stack: errorDetails,
    });

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}