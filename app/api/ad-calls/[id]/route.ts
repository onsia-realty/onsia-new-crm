import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// PATCH /api/ad-calls/[id] - 광고 콜 번호 수정 (배분, 상태 변경 등)
const updateSchema = z.object({
  assignedUserId: z.string().optional(),
  status: z.enum(['PENDING', 'ASSIGNED', 'CONVERTED', 'INVALID']).optional(),
  invalidReason: z.string().optional(),
  notes: z.string().optional(),
  convertedToCustomerId: z.string().optional(),
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

    const { assignedUserId, status, invalidReason, notes, convertedToCustomerId } = validationResult.data;

    const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session.user.role || '');

    // 배분은 관리자만 가능
    if (assignedUserId && !isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can assign ad calls' },
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
