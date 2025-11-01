import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    // 전체 방문 완료 건수 집계 (status가 CHECKED인 경우)
    const topContracts = await prisma.visitSchedule.groupBy({
      by: ['userId'],
      where: {
        status: 'CHECKED',
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
      take: 5,
    });

    // 사용자 정보 조회
    const topEmployees = await Promise.all(
      topContracts.map(async (record) => {
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
    console.error('Error fetching top contracts:', error);
    return NextResponse.json(
      { success: false, message: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
