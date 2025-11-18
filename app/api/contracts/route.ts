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

    // 계약 목록 조회 (InterestCard의 SUBSCRIBED, COMPLETED 상태 활용)
    const contracts = await prisma.interestCard.findMany({
      where: {
        status: {
          in: status ? [status] : ['SUBSCRIBED', 'COMPLETED', 'CANCELLED'],
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
      subscriptionDate: contract.status === 'SUBSCRIBED' ? contract.updatedAt : null,
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
          in: ['SUBSCRIBED', 'COMPLETED', 'CANCELLED'],
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
      subscribed: allContracts.find((item) => item.status === 'SUBSCRIBED')?._count || 0,
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
    const { customerPhone, customerName, assignedSite, status, memo } = body;

    if (!customerPhone) {
      return NextResponse.json(
        { success: false, error: '고객 전화번호는 필수입니다.' },
        { status: 400 }
      );
    }

    const cleanedPhone = customerPhone.replace(/\D/g, '');

    // 기존 고객 찾기 또는 생성
    let customer = await prisma.customer.findFirst({
      where: { phone: cleanedPhone },
    });

    if (!customer) {
      // 새 고객 생성
      customer = await prisma.customer.create({
        data: {
          name: customerName || null,
          phone: cleanedPhone,
          assignedSite: assignedSite || null,
          assignedUserId: session.user.id,
          assignedAt: new Date(),
          grade: 'A', // 계약 고객은 A등급
        },
      });
    }

    // 관심카드 생성 (계약 상태로)
    const contract = await prisma.interestCard.create({
      data: {
        customerId: customer.id,
        propertyType: 'APT',
        transactionType: 'SALE',
        location: assignedSite || '미정',
        status: status || 'SUBSCRIBED',
        memo: memo || null,
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
