import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit';

// DELETE /api/blacklist/[id] - 블랙리스트 해제 (비활성화)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ADMIN, HEAD, TEAM_LEADER만 해제 가능
    if (!['ADMIN', 'HEAD', 'TEAM_LEADER', 'CEO'].includes(session.user.role)) {
      return NextResponse.json(
        { error: '블랙리스트 해제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.blacklist.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '블랙리스트 항목을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 비활성화 (소프트 삭제)
    const updated = await prisma.blacklist.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'DEACTIVATE',
      entity: 'Blacklist',
      entityId: id,
      changes: { phone: existing.phone, previousState: 'active' },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: '블랙리스트에서 해제되었습니다.',
    });
  } catch (error) {
    console.error('Failed to deactivate blacklist entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate blacklist entry' },
      { status: 500 }
    );
  }
}

// PATCH /api/blacklist/[id] - 블랙리스트 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ADMIN, HEAD, TEAM_LEADER만 수정 가능
    if (!['ADMIN', 'HEAD', 'TEAM_LEADER', 'CEO'].includes(session.user.role)) {
      return NextResponse.json(
        { error: '블랙리스트 수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { name, reason, isActive } = body;

    const existing = await prisma.blacklist.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '블랙리스트 항목을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const updated = await prisma.blacklist.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(reason !== undefined && { reason }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        registeredBy: {
          select: { id: true, name: true },
        },
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'Blacklist',
      entityId: id,
      changes: { name, reason, isActive },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Failed to update blacklist entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update blacklist entry' },
      { status: 500 }
    );
  }
}
