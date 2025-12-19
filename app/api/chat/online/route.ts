import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/chat/online - 최근 10분 이내 활동한 사용자 수
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    // 최근 10분 이내 메시지를 보낸 사용자 수
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const activeUsers = await prisma.discussionMessage.findMany({
      where: {
        createdAt: {
          gte: tenMinutesAgo,
        },
      },
      distinct: ['userId'],
      select: {
        userId: true,
      },
    });

    return NextResponse.json({
      success: true,
      count: activeUsers.length,
    });
  } catch (error) {
    console.error('Error fetching online count:', error);
    return NextResponse.json(
      { success: false, error: '접속자 수 조회 실패' },
      { status: 500 }
    );
  }
}
