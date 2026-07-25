import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isBlindHidden } from '@/lib/blind-db/mask';

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
        isBlind: true,
        blindAt: true,
        blindById: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: '고객을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 블라인드DB: 배분 이력엔 원 소유자와 이전 담당자 실명이 전부 드러난다.
    // blindAt 이후 이력만 통과시키고, 경계선을 모르면 전부 가린다(fail-closed).
    const blindHidden = isBlindHidden(
      { id: session.user.id, role: session.user.role },
      customer
    );
    const blindCutoff = blindHidden ? customer.blindAt : null;

    // 배분 이력 조회 (최신순)
    const allocationHistory = blindHidden && !blindCutoff ? [] : await prisma.customerAllocation.findMany({
      where: {
        customerId,
        ...(blindCutoff ? { createdAt: { gte: blindCutoff } } : {}),
      },
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
          // 블라인드DB: 이름은 이전 담당자의 분류 정보이므로 키 자체를 제거
          ...(blindHidden ? {} : { name: customer.name }),
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
