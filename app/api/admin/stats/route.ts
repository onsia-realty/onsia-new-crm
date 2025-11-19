import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/stats - 관리자 통계 조회
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ADMIN만 접근 가능
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 관리자 DB 카운트 (미배분 + 관리자에게 배분된 고객)
    const adminDbCount = await prisma.customer.count({
      where: {
        OR: [
          { assignedUserId: null },
          {
            assignedUser: {
              role: {
                notIn: ['EMPLOYEE', 'TEAM_LEADER', 'HEAD']
              }
            }
          }
        ]
      }
    });

    // 전체 고객 수
    const totalCustomers = await prisma.customer.count();

    // 배분된 고객 수 (직원에게 배분)
    const assignedCount = await prisma.customer.count({
      where: {
        assignedUser: {
          role: {
            in: ['EMPLOYEE', 'TEAM_LEADER', 'HEAD']
          }
        }
      }
    });

    return NextResponse.json({
      adminDbCount,
      totalCustomers,
      assignedCount,
      assignmentRate: totalCustomers > 0 ? Math.round((assignedCount / totalCustomers) * 100) : 0
    });
  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
