import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// 요청 스키마
const reclaimSchema = z.object({
  fromUserId: z.string().cuid('유효한 사용자 ID가 아닙니다'),
  customerIds: z.array(z.string()).optional(), // 특정 고객만 회수할 경우
  reclaimAll: z.boolean().default(false), // 전체 회수 여부
});

// POST /api/admin/reclaim-customers - 관리자가 직원의 DB를 회수
export async function POST(request: Request) {
  try {
    const session = await auth();

    // 관리자 권한 확인
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'CEO')) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { fromUserId, customerIds, reclaimAll } = reclaimSchema.parse(body);

    // 대상 사용자 확인
    const targetUser = await prisma.user.findUnique({
      where: { id: fromUserId },
      select: { id: true, name: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: '대상 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 회수할 고객 조건 설정
    let whereClause: any = {
      assignedUserId: fromUserId,
    };

    if (!reclaimAll && customerIds && customerIds.length > 0) {
      whereClause.id = { in: customerIds };
    }

    // 트랜잭션으로 고객 회수 처리
    const result = await prisma.$transaction(async (tx) => {
      // 회수할 고객 목록 조회
      const customersToReclaim = await tx.customer.findMany({
        where: whereClause,
        select: { id: true, name: true, phone: true },
      });

      if (customersToReclaim.length === 0) {
        throw new Error('회수할 고객이 없습니다.');
      }

      // 고객 회수 (assignedUserId를 null로 설정)
      const updateResult = await tx.customer.updateMany({
        where: whereClause,
        data: {
          assignedUserId: null,
          assignedAt: null,
        },
      });

      // 각 고객에 대해 CustomerAllocation 이력 생성
      await Promise.all(
        customersToReclaim.map((customer) =>
          tx.customerAllocation.create({
            data: {
              customerId: customer.id,
              fromUserId: fromUserId, // 회수당한 담당자
              toUserId: null, // null = 관리자 DB로 회수
              allocatedById: session.user.id, // 회수를 실행한 관리자
              reason: `관리자(${session.user.name})가 DB 회수 - ${reclaimAll ? '전체 회수' : '선택 회수'}`,
            },
          })
        )
      );

      // 감사 로그 기록
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'RECLAIM',
          entity: 'Customer',
          entityId: fromUserId,
          changes: {
            fromUserId,
            fromUserName: targetUser.name,
            customerCount: updateResult.count,
            reclaimAll,
            customerIds: customersToReclaim.map(c => c.id),
            customerNames: customersToReclaim.map(c => ({ id: c.id, name: c.name, phone: c.phone })),
            reclaimedBy: session.user.name,
            reclaimedAt: new Date().toISOString(),
          },
        },
      });

      return { count: updateResult.count, customers: customersToReclaim };
    });

    return NextResponse.json({
      success: true,
      message: `${targetUser.name}님의 고객 ${result.count}명을 관리자 DB로 회수했습니다.`,
      data: {
        reclaimedCount: result.count,
        fromUser: targetUser.name,
        customers: result.customers,
      },
    });
  } catch (error) {
    console.error('Error reclaiming customers:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력 데이터가 올바르지 않습니다.', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '고객 회수 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
