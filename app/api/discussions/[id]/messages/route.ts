import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/discussions/[id]/messages - 메시지 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    const { id: discussionId } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { success: false, error: '메시지 내용은 필수입니다' },
        { status: 400 }
      );
    }

    const message = await prisma.discussionMessage.create({
      data: {
        discussionId,
        userId: session.user.id,
        content,
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    // 토론 updatedAt 갱신
    await prisma.discussion.update({
      where: { id: discussionId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error('Error adding message:', error);
    return NextResponse.json(
      { success: false, error: '메시지 추가 실패' },
      { status: 500 }
    );
  }
}
