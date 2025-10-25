import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkPermission, getUserViewScope, createAuditLog } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // 데이터베이스 연결 확인
    if (!prisma) {
      console.error('Prisma client is not initialized');
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      );
    }

    const session = await auth();
    console.log('Session in users API:', session);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 확인
    let canView = false;
    try {
      canView = await checkPermission('users', 'view');
    } catch (permError) {
      console.error('Permission check error:', permError);
      // Permission 테이블이 비어있거나 에러가 있을 경우, 역할 기반 체크
      const userRole = session.user.role;
      canView = userRole === 'ADMIN' || userRole === 'HEAD' || userRole === 'CEO' || userRole === 'TEAM_LEADER';
    }

    if (!canView) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // 사용자의 조회 범위 가져오기
    const viewScope = await getUserViewScope(session.user.id);
    if (!viewScope) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
    }

    console.log('Fetching users with scope:', viewScope);

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

    console.log(`Fetched ${users.length} users`);

    // 감사 로그 - 에러가 발생해도 API는 정상 동작하도록
    try {
      await createAuditLog(
        session.user.id,
        'VIEW_USERS',
        'User',
        undefined,
        undefined,
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );
    } catch (logError) {
      console.error('Failed to create audit log:', logError);
    }

    return NextResponse.json(users);
  } catch (error) {
    console.error('Failed to fetch users - Full error:', error);

    // Prisma 연결 에러인 경우 상세 메시지
    if (error instanceof Error && error.message.includes('prisma')) {
      return NextResponse.json(
        { error: 'Database connection error. Please check the database connection.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch users' },
      { status: 500 }
    );
  }
}