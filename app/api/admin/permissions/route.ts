import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/permissions - 권한 목록 조회
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const permissions = await prisma.permission.findMany({
      orderBy: [
        { role: 'asc' },
        { resource: 'asc' },
        { action: 'asc' },
      ],
    });

    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Failed to fetch permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}

// POST /api/admin/permissions - 권한 생성
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { role, resource, action, isAllowed } = body;

    const permission = await prisma.permission.create({
      data: {
        role,
        resource,
        action,
        isAllowed: isAllowed ?? true,
      },
    });

    return NextResponse.json(permission);
  } catch (error) {
    console.error('Failed to create permission:', error);
    return NextResponse.json(
      { error: 'Failed to create permission' },
      { status: 500 }
    );
  }
}
