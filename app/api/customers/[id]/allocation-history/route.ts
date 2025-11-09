import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/customers/[id]/allocation-history - 고객의 배분 이력 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: customerId } = await params;

    // 고객 존재 확인
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        phone: true,
        assignedUserId: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: '고객을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 배분 이력 조회 (최신순)
    const allocationHistory = await prisma.customerAllocation.findMany({
      where: { customerId },
      include: {
        fromUser: {
          select: { id: true, name: true, department: true },
        },
        toUser: {
          select: { id: true, name: true, department: true },
        },
        allocatedBy: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 이력 포맷팅
    const formattedHistory = allocationHistory.map((record) => ({
      id: record.id,
      from: record.fromUser
        ? `${record.fromUser.name}${record.fromUser.department ? ` (${record.fromUser.department})` : ''}`
        : '관리자 DB',
      to: record.toUser
        ? `${record.toUser.name}${record.toUser.department ? ` (${record.toUser.department})` : ''}`
        : '관리자 DB',
      allocatedBy: record.allocatedBy
        ? `${record.allocatedBy.name} (${record.allocatedBy.role})`
        : '시스템',
      reason: record.reason || '-',
      createdAt: record.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
        },
        currentAssignment: customer.assignedUserId ? '담당자 배정' : '관리자 DB',
        history: formattedHistory,
        totalRecords: formattedHistory.length,
      },
    });
  } catch (error) {
    console.error('Error fetching allocation history:', error);
    return NextResponse.json(
      { success: false, error: '배분 이력 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
