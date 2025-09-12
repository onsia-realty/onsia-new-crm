import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { checkPermission, createAuditLog } from '@/lib/auth/rbac';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 확인 - 승인은 ADMIN만 가능
    const canApprove = await checkPermission('users', 'approve');
    if (!canApprove) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        role: 'EMPLOYEE',
        isActive: true,
        approvedAt: new Date(),
        approvedBy: session.user.id,
      },
    });

    // 감사 로그
    await createAuditLog(
      session.user.id,
      'APPROVE_USER',
      'User',
      id,
      { approvedUser: user.email },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to approve user:', error);
    return NextResponse.json(
      { error: 'Failed to approve user' },
      { status: 500 }
    );
  }
}