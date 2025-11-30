import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/utils/phone';
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit';

// GET /api/blacklist - 블랙리스트 목록 조회
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('query') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const activeOnly = searchParams.get('activeOnly') !== 'false'; // 기본값: true
    const registeredById = searchParams.get('registeredById'); // 특정 사용자가 등록한 것만 조회

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...(activeOnly && { isActive: true }),
      ...(registeredById && { registeredById }),
      ...(query && {
        OR: [
          { phone: { contains: normalizePhone(query) } },
          { name: { contains: query, mode: 'insensitive' as const } },
          { reason: { contains: query, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [blacklist, total] = await Promise.all([
      prisma.blacklist.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          registeredBy: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.blacklist.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: blacklist,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch blacklist:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch blacklist' },
      { status: 500 }
    );
  }
}

// POST /api/blacklist - 블랙리스트 등록
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 모든 로그인한 직원이 블랙리스트 등록 가능

    const body = await req.json();
    const { phone, name, reason } = body;

    if (!phone || !reason) {
      return NextResponse.json(
        { error: '전화번호와 사유는 필수입니다.' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    // 이미 등록된 번호인지 확인
    const existing = await prisma.blacklist.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existing) {
      // 이미 있으면 활성화
      if (!existing.isActive) {
        const updated = await prisma.blacklist.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            reason,
            name: name || existing.name,
            registeredById: session.user.id,
          },
        });

        await createAuditLog({
          userId: session.user.id,
          action: 'REACTIVATE',
          entity: 'Blacklist',
          entityId: updated.id,
          changes: { phone: normalizedPhone, reason },
          ipAddress: getIpAddress(req),
          userAgent: getUserAgent(req),
        });

        return NextResponse.json({
          success: true,
          data: updated,
          message: '블랙리스트가 다시 활성화되었습니다.',
        });
      }

      return NextResponse.json(
        { error: '이미 블랙리스트에 등록된 번호입니다.' },
        { status: 400 }
      );
    }

    const blacklistEntry = await prisma.blacklist.create({
      data: {
        phone: normalizedPhone,
        name: name || null,
        reason,
        registeredById: session.user.id,
      },
      include: {
        registeredBy: {
          select: { id: true, name: true },
        },
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'CREATE',
      entity: 'Blacklist',
      entityId: blacklistEntry.id,
      changes: { phone: normalizedPhone, name, reason },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({
      success: true,
      data: blacklistEntry,
    });
  } catch (error) {
    console.error('Failed to create blacklist entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create blacklist entry' },
      { status: 500 }
    );
  }
}
