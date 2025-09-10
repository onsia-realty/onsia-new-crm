import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { canViewCustomer, createAuditLog } from '@/lib/auth/rbac';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const userId = searchParams.get('userId');
    const limit = searchParams.get('limit');

    // 권한 확인
    if (customerId) {
      const canView = await canViewCustomer(session.user.id, customerId);
      if (!canView) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }

    const where: Record<string, unknown> = {};
    if (customerId) where.customerId = customerId;
    if (userId) where.userId = userId;

    const callLogs = await prisma.callLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json(callLogs);
  } catch (error) {
    console.error('Failed to fetch call logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, callType, duration, result, comment, nextAction } = await request.json();

    if (!customerId || !callType || !comment) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 고객 접근 권한 확인
    const canView = await canViewCustomer(session.user.id, customerId);
    if (!canView) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const callLog = await prisma.callLog.create({
      data: {
        customerId,
        userId: session.user.id,
        callType,
        duration: duration || null,
        result: result || null,
        comment,
        nextAction: nextAction || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    // 감사 로그
    await createAuditLog(
      session.user.id,
      'CREATE_CALL_LOG',
      'CallLog',
      callLog.id,
      {
        customerId,
        callType,
        result,
      },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return NextResponse.json(callLog);
  } catch (error) {
    console.error('Failed to create call log:', error);
    return NextResponse.json(
      { error: 'Failed to create call log' },
      { status: 500 }
    );
  }
}