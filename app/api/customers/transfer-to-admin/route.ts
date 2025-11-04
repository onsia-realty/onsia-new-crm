/**
 * 관리자에게 고객 전송 API
 * POST /api/customers/transfer-to-admin - 담당자 없는 고객들을 관리자에게 배정
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/utils/audit';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { customerIds } = body;

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json(
        { error: '고객 ID 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    // 관리자 계정 찾기 (역할이 ADMIN인 첫 번째 사용자)
    const adminUser = await prisma.user.findFirst({
      where: {
        role: 'ADMIN',
        approvedAt: {
          not: null
        }
      }
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: '관리자 계정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 고객들을 관리자에게 배정
    const updateResult = await prisma.customer.updateMany({
      where: {
        id: {
          in: customerIds
        },
        assignedUserId: null // 담당자가 없는 고객만
      },
      data: {
        assignedUserId: adminUser.id
      }
    });

    // 감사 로그 기록
    await createAuditLog({
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'Customer',
      entityId: `bulk-${customerIds.length}`,
      changes: {
        action: 'transfer_to_admin',
        customerIds,
        adminId: adminUser.id,
        count: updateResult.count
      }
    });

    return NextResponse.json({
      success: true,
      count: updateResult.count,
      adminName: adminUser.name
    });
  } catch (error: unknown) {
    console.error('고객 전송 오류:', error);
    return NextResponse.json(
      { error: '고객 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
