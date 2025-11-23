import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/visit-schedules - 방문 일정 생성
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { customerId, visitDate, visitType, location, memo } = body;

    // 필수 필드 검증
    if (!customerId || !visitDate || !location) {
      return NextResponse.json(
        { error: '고객 ID, 방문 일시, 장소는 필수입니다.' },
        { status: 400 }
      );
    }

    // 로컬 시간대 기준 날짜로 저장 (UTC 변환 방지)
    // visitDate 형식: "2025-11-23T14:30"
    const localDate = new Date(visitDate);

    // 로컬 시간대를 UTC로 강제 변환하여 저장 (날짜 유지)
    const utcDate = new Date(Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      localDate.getHours(),
      localDate.getMinutes(),
      0,
      0
    ));

    // 방문 일정 생성
    const visitSchedule = await prisma.visitSchedule.create({
      data: {
        customerId,
        userId: session.user.id,
        visitDate: utcDate,
        visitType: visitType || 'PROPERTY_VIEWING',
        location,
        status: 'SCHEDULED',
        memo
      },
      include: {
        customer: true,
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: visitSchedule
    });
  } catch (error) {
    console.error('Failed to create visit schedule:', error);
    return NextResponse.json(
      { success: false, error: '방문 일정 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// GET /api/visit-schedules - 방문 일정 조회
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const month = searchParams.get('month');

    interface WhereClause {
      customerId?: string
      visitDate?: {
        gte: Date
        lt: Date
      }
      userId?: string
    }

    const where: WhereClause = {};
    
    if (customerId) {
      where.customerId = customerId;
    }
    
    if (month) {
      const [year, monthNum] = month.split('-');
      const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(monthNum), 1);
      
      where.visitDate = {
        gte: startDate,
        lt: endDate
      };
    }
    
    // 직원은 자신의 방문 일정만 조회
    if (session.user.role === 'EMPLOYEE') {
      where.userId = session.user.id;
    }

    const visitSchedules = await prisma.visitSchedule.findMany({
      where,
      include: {
        customer: true,
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        visitDate: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      data: visitSchedules
    });
  } catch (error) {
    console.error('Failed to fetch visit schedules:', error);
    return NextResponse.json(
      { success: false, error: '방문 일정 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}