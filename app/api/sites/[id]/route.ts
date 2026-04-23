import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit';

// PATCH /api/sites/[id] - 현장 수정 (ADMIN/CEO만)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['ADMIN', 'CEO'].includes(session.user.role)) {
      return NextResponse.json(
        { error: '현장 수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.site.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '현장을 찾을 수 없습니다.' }, { status: 404 });
    }

    const data: { name?: string; color?: string; icon?: string; sortOrder?: number; isActive?: boolean } = {};
    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: '현장명은 필수입니다.' }, { status: 400 });
      }
      if (name !== existing.name) {
        const dup = await prisma.site.findUnique({ where: { name } });
        if (dup) {
          return NextResponse.json({ error: '이미 사용 중인 현장명입니다.' }, { status: 400 });
        }
      }
      data.name = name;
    }
    if (typeof body.color === 'string') data.color = body.color.trim();
    if (typeof body.icon === 'string') data.icon = body.icon.trim();
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

    const updated = await prisma.site.update({ where: { id }, data });

    await createAuditLog({
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'Site',
      entityId: id,
      changes: data,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Failed to update site:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update site' },
      { status: 500 }
    );
  }
}

// DELETE /api/sites/[id] - 비활성화 (soft delete, ADMIN/CEO만)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['ADMIN', 'CEO'].includes(session.user.role)) {
      return NextResponse.json(
        { error: '현장 삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.site.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '현장을 찾을 수 없습니다.' }, { status: 404 });
    }

    const updated = await prisma.site.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'DEACTIVATE',
      entity: 'Site',
      entityId: id,
      changes: { name: existing.name },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: '현장이 비활성화되었습니다. (기존 배정된 고객은 영향 없음)',
    });
  } catch (error) {
    console.error('Failed to deactivate site:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate site' },
      { status: 500 }
    );
  }
}
