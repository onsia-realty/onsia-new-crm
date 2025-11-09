import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// GET /api/ad-calls - 광고 콜 번호 목록 조회
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // PENDING/ASSIGNED/CONVERTED/INVALID
    const userId = searchParams.get('userId'); // 특정 직원에게 배분된 것만
    const source = searchParams.get('source'); // 광고 출처

    const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session.user.role || '');

    // 직원은 자기에게 배분된 것만 볼 수 있음
    const where: {
      assignedUserId?: string;
      status?: string;
      source?: string;
    } = {};

    if (!isAdmin) {
      where.assignedUserId = session.user.id;
    } else {
      if (userId) {
        where.assignedUserId = userId;
      }
    }

    if (status) {
      where.status = status;
    }

    if (source) {
      where.source = source;
    }

    const adCalls = await prisma.adCallNumber.findMany({
      where,
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        receivedAt: 'desc',
      },
    });

    // 통계 정보
    const stats = await prisma.adCallNumber.groupBy({
      by: ['status'],
      where: isAdmin ? {} : { assignedUserId: session.user.id },
      _count: {
        id: true,
      },
    });

    const statsMap = stats.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: adCalls,
      stats: statsMap,
    });
  } catch (error) {
    console.error('Failed to fetch ad calls:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ad calls' },
      { status: 500 }
    );
  }
}

// POST /api/ad-calls - 광고 콜 번호 등록 (엑셀 업로드 또는 단건 등록)
const createSchema = z.object({
  phone: z.string().min(1, '전화번호를 입력해주세요'),
  source: z.string().optional(),
  siteName: z.string().optional(),
  notes: z.string().optional(),
});

const bulkCreateSchema = z.object({
  calls: z.array(createSchema),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자만 등록 가능
    const isAdmin = ['ADMIN', 'HEAD', 'CEO'].includes(session.user.role || '');
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can register ad calls' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 일괄 등록
    if (body.calls && Array.isArray(body.calls)) {
      const validationResult = bulkCreateSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: validationResult.error },
          { status: 400 }
        );
      }

      const calls = validationResult.data.calls.map(call => ({
        phone: call.phone.replace(/\D/g, ''), // 숫자만 추출
        source: call.source,
        siteName: call.siteName,
        notes: call.notes,
        status: 'PENDING' as const,
      }));

      const result = await prisma.adCallNumber.createMany({
        data: calls,
        skipDuplicates: true,
      });

      return NextResponse.json({
        success: true,
        count: result.count,
      });
    }

    // 단건 등록
    const validationResult = createSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error },
        { status: 400 }
      );
    }

    // 전화번호에서 숫자만 추출
    const cleanedPhone = validationResult.data.phone.replace(/\D/g, '');

    // 전화번호 유효성 검사
    if (cleanedPhone.length < 10) {
      return NextResponse.json(
        { error: '올바른 전화번호를 입력해주세요. (최소 10자리)' },
        { status: 400 }
      );
    }

    const adCall = await prisma.adCallNumber.create({
      data: {
        phone: cleanedPhone,
        source: validationResult.data.source,
        siteName: validationResult.data.siteName,
        notes: validationResult.data.notes,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      data: adCall,
    });
  } catch (error) {
    console.error('Failed to create ad call:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create ad call' },
      { status: 500 }
    );
  }
}
