import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/discussions - 토론/채팅 목록 조회
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as 'VISIT_SCHEDULE' | 'SUGGESTION' | null;
    const date = searchParams.get('date'); // 오늘 날짜 (YYYY-MM-DD)

    const where: any = {
      isClosed: false, // 종료되지 않은 것만
    };

    if (type) {
      where.type = type;
    }

    // 방문일정 타입이고 날짜가 지정된 경우 오늘 일정만
    if (type === 'VISIT_SCHEDULE' && date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      where.visitSchedule = {
        visitDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      };
    }

    const discussions = await prisma.discussion.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, role: true },
        },
        visitSchedule: {
          include: {
            customer: {
              select: { id: true, name: true, phone: true },
            },
            user: {
              select: { id: true, name: true },
            },
          },
        },
        messages: {
          include: {
            user: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 50, // 최근 50개만
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: discussions,
    });
  } catch (error) {
    console.error('Error fetching discussions:', error);
    return NextResponse.json(
      { success: false, error: '토론 목록 조회 실패' },
      { status: 500 }
    );
  }
}

// POST /api/discussions - 새 토론 생성 (건의사항)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    const body = await req.json();
    const { title, content, priority } = body;

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: '제목과 내용은 필수입니다' },
        { status: 400 }
      );
    }

    // 트랜잭션: 토론 생성 + 첫 메시지 추가
    const discussion = await prisma.discussion.create({
      data: {
        type: 'SUGGESTION',
        title,
        status: 'PENDING',
        priority: priority || 'MEDIUM',
        createdById: session.user.id,
        messages: {
          create: {
            userId: session.user.id,
            content,
          },
        },
      },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true },
        },
        messages: {
          include: {
            user: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: discussion,
    });
  } catch (error) {
    console.error('Error creating discussion:', error);
    return NextResponse.json(
      { success: false, error: '건의사항 등록 실패' },
      { status: 500 }
    );
  }
}
