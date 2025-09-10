import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { checkPermission, getUserViewScope, createAuditLog } from '@/lib/auth/rbac';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 확인
    const canView = await checkPermission('users', 'view');
    if (!canView) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // 사용자의 조회 범위 가져오기
    const viewScope = await getUserViewScope(session.user.id);
    if (!viewScope) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
    }

    const users = await prisma.user.findMany({
      where: viewScope,
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    // 감사 로그
    await createAuditLog(
      session.user.id,
      'VIEW_USERS',
      'User',
      undefined,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return NextResponse.json(users);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}