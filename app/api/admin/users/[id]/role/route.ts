import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Role } from '@prisma/client';
import { auth } from '@/lib/auth';
import { checkPermission, createAuditLog } from '@/lib/auth/rbac';

const prisma = new PrismaClient();

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
    const canUpdate = await checkPermission('users', 'update');
    if (!canUpdate) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { role } = await request.json();

    if (!['EMPLOYEE', 'TEAM_LEADER', 'HEAD', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const previousUser = await prisma.user.findUnique({
      where: { id },
    });

    const user = await prisma.user.update({
      where: { id },
      data: {
        role: role as Role,
      },
    });

    // 감사 로그
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

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to update user role:', error);
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}