import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit';

// GET /api/sites - 활성 현장 목록 (모든 로그인 사용자)
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sites = await prisma.site.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        color: true,
        icon: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ success: true, data: sites });
  } catch (error) {
    console.error('Failed to fetch sites:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sites' },
      { status: 500 }
    );
  }
}

// POST /api/sites - 현장 생성 (ADMIN/CEO만)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['ADMIN', 'CEO'].includes(session.user.role)) {
      return NextResponse.json(
        { error: '현장 생성 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const color = typeof body.color === 'string' ? body.color.trim() : 'cyan';
    const icon = typeof body.icon === 'string' ? body.icon.trim() : '🏢';
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : 0;

    if (!name) {
      return NextResponse.json(
        { error: '현장명은 필수입니다.' },
        { status: 400 }
      );
    }

    if (name.length > 50) {
      return NextResponse.json(
        { error: '현장명은 50자 이하여야 합니다.' },
        { status: 400 }
      );
    }

    // 기존에 같은 이름이 있으면 활성 상태로 되돌림 (idempotent)
    const existing = await prisma.site.findUnique({ where: { name } });
    if (existing) {
      if (!existing.isActive) {
        const reactivated = await prisma.site.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
        await createAuditLog({
          userId: session.user.id,
          action: 'REACTIVATE',
          entity: 'Site',
          entityId: reactivated.id,
          changes: { name },
          ipAddress: getIpAddress(req),
          userAgent: getUserAgent(req),
        });
        return NextResponse.json({
          success: true,
          data: reactivated,
          message: '기존 현장이 재활성화되었습니다.',
        });
      }
      return NextResponse.json(
        { error: '이미 등록된 현장명입니다.' },
        { status: 400 }
      );
    }

    const site = await prisma.site.create({
      data: {
        name,
        color,
        icon,
        sortOrder,
        createdById: session.user.id,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'CREATE',
      entity: 'Site',
      entityId: site.id,
      changes: { name, color, icon, sortOrder },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({ success: true, data: site });
  } catch (error) {
    console.error('Failed to create site:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create site' },
      { status: 500 }
    );
  }
}
