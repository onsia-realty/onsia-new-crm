import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/contracts - 계약 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const site = searchParams.get('site');

    const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session.user.role);

    // 기본 조건
    const where: Record<string, unknown> = {};

    // 관리자가 아니면 자신의 계약만 조회
    if (!isAdmin) {
      where.userId = session.user.id;
    }

    // 상태 필터
    if (status && status !== 'all') {
      where.status = status;
    }

    // 현장 필터
    if (site && site !== 'all') {
      where.assignedSite = site;
    }

    // 계약 목록 조회 (InterestCard의 ACTIVE, COMPLETED 상태 활용)
    const contracts = await prisma.interestCard.findMany({
      where: {
        status: {
          in: status ? [status] : ['ACTIVE', 'COMPLETED', 'CANCELLED'],
        },
        ...(site && site !== 'all' ? {
          customer: {
            assignedSite: site,
          },
        } : {}),
        ...(!isAdmin ? {
          customer: {
            assignedUserId: session.user.id,
          },
        } : {}),
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            assignedSite: true,
            assignedUser: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 데이터 변환
    const formattedContracts = contracts.map((contract) => ({
      id: contract.id,
      customerId: contract.customer?.id || '',
      customerName: contract.customer?.name || '',
      customerPhone: contract.customer?.phone || '',
      assignedSite: contract.customer?.assignedSite || null,
      status: contract.status,
      contractDate: contract.status === 'COMPLETED' ? contract.updatedAt : null,
      activeDate: contract.status === 'ACTIVE' ? contract.updatedAt : null,
      amount: null, // TODO: 금액 필드 추가 필요
      memo: contract.memo,
      userId: contract.customer?.assignedUser?.id || '',
      userName: contract.customer?.assignedUser?.name || '미배분',
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    }));

    // 통계
    const allContracts = await prisma.interestCard.groupBy({
      by: ['status'],
      where: {
        status: {
          in: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
        },
        ...(!isAdmin ? {
          customer: {
            assignedUserId: session.user.id,
          },
        } : {}),
      },
      _count: true,
    });

    const stats = {
      total: allContracts.reduce((sum, item) => sum + item._count, 0),
      active: allContracts.find((item) => item.status === 'ACTIVE')?._count || 0,
      completed: allContracts.find((item) => item.status === 'COMPLETED')?._count || 0,
      cancelled: allContracts.find((item) => item.status === 'CANCELLED')?._count || 0,
    };

    return NextResponse.json({
      success: true,
      data: formattedContracts,
      stats,
    });
  } catch (error) {
    console.error('Failed to fetch contracts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch contracts' },
      { status: 500 }
    );
  }
}

// POST /api/contracts - 신규 계약 등록
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, assignedSite, status, memo, amount } = body;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: '고객을 선택해주세요.' },
        { status: 400 }
      );
    }

    if (!assignedSite) {
      return NextResponse.json(
        { success: false, error: '현장명을 선택해주세요.' },
        { status: 400 }
      );
    }

    // 고객 존재 여부 확인
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: '고객을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 고객의 현장 정보 업데이트
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        assignedSite: assignedSite,
        grade: 'A', // 계약 고객은 A등급
      },
    });

    // 관심카드 생성 (계약 상태로)
    const contract = await prisma.interestCard.create({
      data: {
        customerId: customer.id,
        propertyType: 'APARTMENT',
        transactionType: 'SALE',
        location: assignedSite || '미정',
        status: status || 'ACTIVE',
        memo: memo || null,
        amount: amount || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    console.error('Failed to create contract:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create contract' },
      { status: 500 }
    );
  }
}
