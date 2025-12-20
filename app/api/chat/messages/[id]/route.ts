import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/chat/messages/[id] - 메시지 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    const { id: messageId } = await params;

    // 메시지 확인
    const message = await prisma.discussionMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: '메시지를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 본인 메시지만 삭제 가능
    if (message.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '본인의 메시지만 삭제할 수 있습니다' },
        { status: 403 }
      );
    }

    // 메시지 삭제
    await prisma.discussionMessage.delete({
      where: { id: messageId },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { success: false, error: `메시지 삭제 실패: ${errorMessage}` },
      { status: 500 }
    );
  }
}
