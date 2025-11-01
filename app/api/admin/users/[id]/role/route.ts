import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { auth } from '@/lib/auth';
import { checkPermission, createAuditLog } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 확인 - 사용자 수정은 ADMIN만 가능
    let canUpdate = false;
    try {
      canUpdate = await checkPermission('users', 'update');
    } catch (permError) {
      console.error('Permission check error:', permError);
      // Permission 테이블이 비어있거나 에러가 있을 경우, 역할 기반 체크
      const userRole = session.user.role;
      canUpdate = userRole === 'ADMIN' || userRole === 'CEO';
    }

    if (!canUpdate) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { role } = await request.json();

    if (!['EMPLOYEE', 'TEAM_LEADER', 'HEAD', 'ADMIN', 'CEO'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const previousUser = await prisma.user.findUnique({
      where: { id },
    });

    // CEO는 역할 변경 불가 (보호)
    if (previousUser?.role === 'CEO') {
      return NextResponse.json(
        { error: 'CEO 계정의 역할은 변경할 수 없습니다.' },
        { status: 403 }
      );
    }

    // ADMIN은 CEO로 역할 변경 불가
    if (role === 'CEO' && session.user.role !== 'CEO') {
      return NextResponse.json(
        { error: 'CEO 역할은 부여할 수 없습니다.' },
        { status: 403 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        role: role as Role,
      },
    });

    // 감사 로그 - 에러가 발생해도 API는 정상 동작하도록
    try {
      await createAuditLog(
        session.user.id,
        'UPDATE_USER_ROLE',
        'User',
        id,
        {
          previousRole: previousUser?.role,
          newRole: role,
          userEmail: user.email,
        },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );
    } catch (logError) {
      console.error('Failed to create audit log:', logError);
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to update user role:', error);
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}