import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { notifyAdCallAssigned } from '@/lib/push/notify-ad-calls';

// GET /api/ad-calls/[id] - 광고 콜 단건 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session.user.role || '');

    const adCall = await prisma.adCallNumber.findUnique({
      where: { id },
      include: {
        assignedUser: {
          select: { id: true, name: true, username: true },
        },
        assignedBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!adCall) {
      return NextResponse.json(
        { success: false, error: '광고 콜을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 직원은 본인 배정 콜만 조회 가능
    if (!isAdmin && adCall.assignedUserId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '본인에게 배정된 광고 콜만 조회할 수 있습니다' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: adCall });
  } catch (error) {
    console.error('Failed to fetch ad call:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ad call' },
      { status: 500 }
    );
  }
}

// PATCH /api/ad-calls/[id] - 광고 콜 번호 수정 (배분, 상태 변경 등)
const updateSchema = z.object({
  assignedUserId: z.string().optional(),
  status: z.enum(['PENDING', 'ASSIGNED', 'CONVERTED', 'INVALID']).optional(),
  invalidReason: z.string().optional(),
  notes: z.string().optional(),
  convertedToCustomerId: z.string().optional(),
  source: z.string().optional(), // 광고 출처 (관리자만 수정 가능)
  siteName: z.string().optional(), // 현장명 (관리자만 수정 가능)
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validationResult = updateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error },
        { status: 400 }
      );
    }

    const { assignedUserId, status, invalidReason, notes, convertedToCustomerId, source, siteName } = validationResult.data;

    const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session.user.role || '');

    // 배분은 관리자만 가능
    if (assignedUserId && !isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can assign ad calls' },
        { status: 403 }
      );
    }

    // 광고 출처, 현장명 수정은 관리자만 가능
    if ((source !== undefined || siteName !== undefined) && !isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can edit source and site name' },
        { status: 403 }
      );
    }

    const updateData: {
      assignedUserId?: string | null;
      assignedAt?: Date;
      assignedById?: string;
      status?: 'PENDING' | 'ASSIGNED' | 'CONVERTED' | 'INVALID';
      invalidReason?: string | null;
      notes?: string | null;
      convertedToCustomerId?: string | null;
      source?: string | null;
      siteName?: string | null;
    } = {};

    if (assignedUserId !== undefined) {
      updateData.assignedUserId = assignedUserId;
      updateData.assignedAt = new Date();
      updateData.assignedById = session.user.id;
      updateData.status = 'ASSIGNED';
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    if (invalidReason !== undefined) {
      updateData.invalidReason = invalidReason;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (convertedToCustomerId !== undefined) {
      updateData.convertedToCustomerId = convertedToCustomerId;
      updateData.status = 'CONVERTED';
    }

    if (source !== undefined) {
      updateData.source = source || null;
    }

    if (siteName !== undefined) {
      updateData.siteName = siteName || null;
    }

    const adCall = await prisma.adCallNumber.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.adCallNumber.update>[0]['data'],
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    // 신규 배정 시에만 푸시 발송 (status가 ASSIGNED로 바뀐 경우)
    if (assignedUserId && updateData.status === 'ASSIGNED') {
      await notifyAdCallAssigned(adCall.id, assignedUserId);
    }

    return NextResponse.json({
      success: true,
      data: adCall,
    });
  } catch (error) {
    console.error('Failed to update ad call:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update ad call' },
      { status: 500 }
    );
  }
}

// DELETE /api/ad-calls/[id] - 광고 콜 번호 삭제
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session.user.role || '');
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can delete ad calls' },
        { status: 403 }
      );
    }

    await prisma.adCallNumber.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Failed to delete ad call:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete ad call' },
      { status: 500 }
    );
  }
}
