import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  getCurrentWeekKey,
  isValidWeekKey,
} from '@/lib/ad-calls/week-key';
import { normalizePhone } from '@/lib/utils/phone';

// POST /api/ad-calls/awards
// 관리자(ADMIN/HEAD)가 직원에게 광고콜 시상(배분) 등록
//
// Body:
//   - userId       : 받는 직원
//   - siteName?    : 현장명
//   - feedback?    : 관리자 코멘트
//   - weekKey?     : 시상 주간 (생략 시 현재 주)
//   - source?      : 광고매체 (메타광고/네이버 등) — phones 모드에서 새 AdCallNumber에 저장
//   - 셋 중 하나:
//       (A) adCallIds: string[]  ← 기존 PENDING 풀에서 선택
//       (B) phones:    string[]  ← 신규 번호 직접 입력 (자동으로 AdCallNumber 생성)
//       (C) count:     number    ← 수량만 (개별 콜 추적 불가)

const PostSchema = z
  .object({
    userId: z.string().min(1, '직원을 선택해주세요'),
    siteName: z.string().optional().nullable(),
    feedback: z.string().optional().nullable(),
    weekKey: z.string().optional(),
    source: z.string().optional().nullable(),
    adCallIds: z.array(z.string()).optional(),
    phones: z.array(z.string()).optional(),
    count: z.number().int().positive().optional(),
  })
  .refine(
    (d) =>
      (d.adCallIds && d.adCallIds.length > 0) ||
      (d.phones && d.phones.length > 0) ||
      (d.count && d.count > 0),
    {
      message: 'adCallIds, phones, count 중 하나는 필수입니다',
    }
  );

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = session.user.role;
    if (role !== 'ADMIN' && role !== 'HEAD') {
      return NextResponse.json(
        { success: false, error: '관리자만 시상 배분이 가능합니다' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? '입력값 오류',
        },
        { status: 400 }
      );
    }

    const { userId, siteName, feedback, adCallIds, source } = parsed.data;
    const weekKey =
      parsed.data.weekKey && isValidWeekKey(parsed.data.weekKey)
        ? parsed.data.weekKey
        : getCurrentWeekKey();

    // 직원 존재 확인
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, isActive: true },
    });
    if (!targetUser || !targetUser.isActive) {
      return NextResponse.json(
        { success: false, error: '대상 직원을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 분기: PENDING 풀 / 신규 번호 입력 / 수량만
    const isPoolMode = adCallIds && adCallIds.length > 0;
    const isPhonesMode = !isPoolMode && parsed.data.phones && parsed.data.phones.length > 0;
    const isCountMode = !isPoolMode && !isPhonesMode;

    // 신규 번호 정규화
    const normalizedPhones: string[] = [];
    if (isPhonesMode) {
      const seen = new Set<string>();
      for (const raw of parsed.data.phones!) {
        const normalized = normalizePhone(raw);
        if (normalized.length < 10 || normalized.length > 11) continue;
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        normalizedPhones.push(normalized);
      }
      if (normalizedPhones.length === 0) {
        return NextResponse.json(
          { success: false, error: '유효한 전화번호가 없습니다 (10~11자리)' },
          { status: 400 }
        );
      }
    }

    const finalCount = isPoolMode
      ? adCallIds.length
      : isPhonesMode
        ? normalizedPhones.length
        : parsed.data.count!;

    // 풀 모드: 선택한 콜이 PENDING 상태이고 미배분인지 검증
    if (isPoolMode) {
      const pendingCalls = await prisma.adCallNumber.findMany({
        where: { id: { in: adCallIds } },
        select: { id: true, status: true, awardId: true },
      });
      if (pendingCalls.length !== adCallIds.length) {
        return NextResponse.json(
          { success: false, error: '존재하지 않는 광고콜이 포함되어 있습니다' },
          { status: 400 }
        );
      }
      const alreadyAssigned = pendingCalls.filter(
        (c) => c.awardId !== null || c.status === 'ASSIGNED' || c.status === 'CONVERTED'
      );
      if (alreadyAssigned.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `이미 배분된 광고콜이 ${alreadyAssigned.length}건 포함되어 있습니다`,
          },
          { status: 400 }
        );
      }
    }

    // 트랜잭션
    const now = new Date();
    const award = await prisma.$transaction(async (tx) => {
      const created = await tx.adCallAward.create({
        data: {
          userId,
          siteName: siteName ?? null,
          count: finalCount,
          weekKey,
          feedback: feedback ?? null,
          awardedById: session.user.id,
        },
      });

      // 풀 모드: 기존 AdCallNumber에 awardId 연결
      if (isPoolMode) {
        await tx.adCallNumber.updateMany({
          where: { id: { in: adCallIds } },
          data: {
            awardId: created.id,
            assignedUserId: userId,
            assignedById: session.user.id,
            assignedAt: now,
            status: 'ASSIGNED',
          },
        });
      }

      // phones 모드: 신규 AdCallNumber 생성 + award 연결
      if (isPhonesMode) {
        await tx.adCallNumber.createMany({
          data: normalizedPhones.map((phone) => ({
            phone,
            siteName: siteName ?? null,
            source: source ?? null,
            assignedUserId: userId,
            assignedById: session.user.id,
            assignedAt: now,
            status: 'ASSIGNED' as const,
            awardId: created.id,
          })),
        });
      }

      // 감사 로그
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CREATE',
          entity: 'AdCallAward',
          entityId: created.id,
          changes: JSON.parse(
            JSON.stringify({
              targetUserId: userId,
              targetUserName: targetUser.name,
              siteName: siteName ?? null,
              count: finalCount,
              weekKey,
              mode: isPoolMode ? 'pool' : isPhonesMode ? 'phones' : 'count',
              hasFeedback: !!feedback,
              source: source ?? null,
            })
          ),
        },
      });

      return created;
    });
    void isCountMode; // 분기 표시용

    return NextResponse.json({
      success: true,
      data: {
        id: award.id,
        userId: award.userId,
        siteName: award.siteName,
        count: award.count,
        weekKey: award.weekKey,
        feedback: award.feedback,
      },
    });
  } catch (error) {
    console.error('Failed to create award:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create award' },
      { status: 500 }
    );
  }
}

// GET /api/ad-calls/awards (관리자용 — 모든 시상 이력 조회 / 직원별 필터)
// 관리자 배분 폼에서 "최근 시상 이력" 표시용
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = session.user.role;
    if (role !== 'ADMIN' && role !== 'HEAD') {
      return NextResponse.json(
        { success: false, error: '관리자만 조회 가능합니다' },
        { status: 403 }
      );
    }

    const weekParam = req.nextUrl.searchParams.get('week');
    const userIdFilter = req.nextUrl.searchParams.get('userId');
    const weekKey =
      weekParam && isValidWeekKey(weekParam) ? weekParam : getCurrentWeekKey();

    const awards = await prisma.adCallAward.findMany({
      where: {
        weekKey,
        ...(userIdFilter ? { userId: userIdFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, department: true } },
        awardedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        weekKey,
        awards: awards.map((a) => ({
          id: a.id,
          userId: a.userId,
          userName: a.user.name,
          department: a.user.department,
          siteName: a.siteName,
          count: a.count,
          feedback: a.feedback,
          awardedByName: a.awardedBy.name,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Failed to fetch awards:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch awards' },
      { status: 500 }
    );
  }
}
