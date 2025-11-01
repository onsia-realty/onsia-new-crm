import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    // 이번 주의 시작일과 종료일 계산
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // 이번 주 방문 건수 집계 (모든 상태 포함)
    const topVisits = await prisma.visitSchedule.groupBy({
      by: ['userId'],
      where: {
        visitDate: {
          gte: startOfWeek,
          lt: endOfWeek,
        },
        userId: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 3,
    });

    // 사용자 정보 조회
    const topEmployees = await Promise.all(
      topVisits.map(async (record) => {
        const user = await prisma.user.findUnique({
          where: { id: record.userId! },
          select: { id: true, name: true },
        });
        return {
          id: user?.id || '',
          name: user?.name || '알 수 없음',
          count: record._count.id,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: topEmployees,
    });
  } catch (error) {
    console.error('Error fetching top visits:', error);
    return NextResponse.json(
      { success: false, message: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
