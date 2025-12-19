import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/chat/suggestion - 건의사항 채팅 메시지 조회
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    // 건의사항 채팅방 찾기 또는 생성
    let discussion = await prisma.discussion.findFirst({
      where: {
        AND: [
          { type: 'SUGGESTION' },
          { title: '건의사항' },
          { visitScheduleId: { equals: null } },
        ],
      },
    });

    if (!discussion) {
      discussion = await prisma.discussion.create({
        data: {
          type: 'SUGGESTION',
          title: '건의사항',
          status: 'PENDING',
          priority: 'MEDIUM',
          createdById: session.user.id,
          visitScheduleId: null,
        },
      });
    }

    // 메시지 조회 (최근 100개)
    const messages = await prisma.discussionMessage.findMany({
      where: {
        discussionId: discussion.id,
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error('Error fetching suggestion chat:', error);
    return NextResponse.json(
      { success: false, error: '메시지 조회 실패' },
      { status: 500 }
    );
  }
}

// POST /api/chat/suggestion - 건의사항 채팅 메시지 전송
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    const body = await req.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: '메시지 내용은 필수입니다' },
        { status: 400 }
      );
    }

    // 건의사항 채팅방 찾기 또는 생성
    let discussion = await prisma.discussion.findFirst({
      where: {
        AND: [
          { type: 'SUGGESTION' },
          { title: '건의사항' },
          { visitScheduleId: { equals: null } },
        ],
      },
    });

    if (!discussion) {
      discussion = await prisma.discussion.create({
        data: {
          type: 'SUGGESTION',
          title: '건의사항',
          status: 'PENDING',
          priority: 'MEDIUM',
          createdById: session.user.id,
          visitScheduleId: null,
        },
      });
    }

    // 메시지 추가
    const message = await prisma.discussionMessage.create({
      data: {
        discussionId: discussion.id,
        userId: session.user.id,
        content: content.trim(),
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    // 토론 updatedAt 갱신
    await prisma.discussion.update({
      where: { id: discussion.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Error sending suggestion chat message:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { success: false, error: `메시지 전송 실패: ${errorMessage}` },
      { status: 500 }
    );
  }
}
