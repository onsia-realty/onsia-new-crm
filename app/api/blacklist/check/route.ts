import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/utils/phone';

// GET /api/blacklist/check?phone=01012345678 - 블랙리스트 체크
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: '전화번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    const blacklistEntry = await prisma.blacklist.findFirst({
      where: {
        phone: normalizedPhone,
        isActive: true,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        reason: true,
        createdAt: true,
        registeredBy: {
          select: { name: true },
        },
      },
    });

    if (blacklistEntry) {
      return NextResponse.json({
        success: true,
        isBlacklisted: true,
        data: blacklistEntry,
      });
    }

    return NextResponse.json({
      success: true,
      isBlacklisted: false,
      data: null,
    });
  } catch (error) {
    console.error('Failed to check blacklist:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check blacklist' },
      { status: 500 }
    );
  }
}

// POST /api/blacklist/check - 여러 전화번호 블랙리스트 체크
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { phones } = body;

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json(
        { error: '전화번호 배열을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 최대 1000개 제한
    if (phones.length > 1000) {
      return NextResponse.json(
        { error: '한 번에 최대 1000개까지 체크할 수 있습니다.' },
        { status: 400 }
      );
    }

    const normalizedPhones = phones.map((p: string) => normalizePhone(p));

    const blacklistEntries = await prisma.blacklist.findMany({
      where: {
        phone: { in: normalizedPhones },
        isActive: true,
      },
      select: {
        phone: true,
        name: true,
        reason: true,
      },
    });

    const blacklistedSet = new Set(blacklistEntries.map(b => b.phone));

    // 결과를 맵으로 변환
    const results = normalizedPhones.map((phone: string, index: number) => ({
      originalPhone: phones[index],
      normalizedPhone: phone,
      isBlacklisted: blacklistedSet.has(phone),
      blacklistInfo: blacklistEntries.find(b => b.phone === phone) || null,
    }));

    return NextResponse.json({
      success: true,
      total: phones.length,
      blacklistedCount: blacklistEntries.length,
      results,
    });
  } catch (error) {
    console.error('Failed to check blacklist batch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check blacklist batch' },
      { status: 500 }
    );
  }
}
