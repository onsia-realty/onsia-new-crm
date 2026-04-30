import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { normalizePhone } from '@/lib/utils/phone';

// POST /api/ad-calls/[id]/convert-to-customer
// 받은 광고콜을 본인의 고객(개인 DB)으로 등록 — 카톡 양식 매핑
//
// Body (모두 옵션, siteName/name만 필수):
//   siteName        : 현장 (필수)
//   name            : 고객성명 (필수)
//   gender          : MALE | FEMALE
//   ageRange        : TWENTIES | THIRTIES | FORTIES | FIFTIES | SIXTIES_PLUS
//   residenceArea   : 거주지역
//   adMedia         : 광고매체 (메타광고/네이버 등 — memo prefix로 저장)
//   counselContent  : 상담내용
//   visitDate       : 방문일시 (ISO datetime)
//   visitCount      : 방문인원 (string)
//   carNumber       : 차량번호
//   grade           : A | B | C (감도)

const PostSchema = z.object({
  siteName: z.string().min(1, '현장을 선택해주세요'),
  name: z.string().min(1, '고객성명을 입력해주세요'),
  gender: z.enum(['MALE', 'FEMALE']).optional().nullable(),
  ageRange: z
    .enum(['TWENTIES', 'THIRTIES', 'FORTIES', 'FIFTIES', 'SIXTIES_PLUS'])
    .optional()
    .nullable(),
  residenceArea: z.string().optional().nullable(),
  adMedia: z.string().optional().nullable(),
  counselContent: z.string().optional().nullable(),
  visitDate: z.string().optional().nullable(),
  visitCount: z.string().optional().nullable(),
  carNumber: z.string().optional().nullable(),
  grade: z.enum(['A', 'B', 'C']).optional().nullable(),
});

function buildMemo(input: z.infer<typeof PostSchema>): string {
  // 카톡 양식 형태로 메모 자동 생성
  const lines: string[] = [];
  if (input.adMedia) lines.push(`광고매체: ${input.adMedia}`);
  if (input.counselContent) lines.push(`상담내용: ${input.counselContent}`);
  if (input.visitCount) lines.push(`방문인원: ${input.visitCount}`);
  if (input.carNumber) lines.push(`차량번호: ${input.carNumber}`);
  return lines.join('\n');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const body = await req.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? '입력값 오류' },
        { status: 400 }
      );
    }
    const input = parsed.data;

    // 광고콜 조회 + 권한 검증
    const adCall = await prisma.adCallNumber.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        siteName: true,
        source: true,
        assignedUserId: true,
        status: true,
        convertedToCustomerId: true,
      },
    });
    if (!adCall) {
      return NextResponse.json(
        { success: false, error: '광고콜을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const isOwner = adCall.assignedUserId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'HEAD';
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '본인이 받은 광고콜만 전환할 수 있습니다' },
        { status: 403 }
      );
    }

    if (adCall.status === 'CONVERTED' && adCall.convertedToCustomerId) {
      return NextResponse.json(
        { success: false, error: '이미 고객으로 전환된 광고콜입니다' },
        { status: 400 }
      );
    }

    const phone = normalizePhone(adCall.phone);
    const targetUserId = isOwner ? session.user.id : adCall.assignedUserId!;
    const visitDateObj =
      input.visitDate && input.visitDate.length > 0 ? new Date(input.visitDate) : null;
    const memo = buildMemo(input);

    // 트랜잭션
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          phone,
          name: input.name.trim(),
          memo: memo || null,
          source: 'AD',
          gender: input.gender ?? null,
          ageRange: input.ageRange ?? null,
          residenceArea: input.residenceArea?.trim() || null,
          nextVisitDate: visitDateObj,
          assignedUserId: targetUserId,
          assignedAt: new Date(),
          assignedSite: input.siteName,
          grade: input.grade ?? 'C',
          isPublic: false,
          isDeleted: false,
        },
      });

      await tx.adCallNumber.update({
        where: { id: adCall.id },
        data: {
          status: 'CONVERTED',
          convertedToCustomerId: customer.id,
          // 광고매체가 입력되면 AdCallNumber.source에도 백필
          source: input.adMedia ?? adCall.source,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CREATE',
          entity: 'Customer',
          entityId: customer.id,
          changes: JSON.parse(
            JSON.stringify({
              from: 'AdCallNumber',
              adCallId: adCall.id,
              phone,
              siteName: input.siteName,
              targetUserId,
              hasFullForm: !!(input.gender || input.ageRange || input.residenceArea || memo),
            })
          ),
        },
      });

      return customer;
    });

    return NextResponse.json({
      success: true,
      data: {
        customerId: result.id,
        name: result.name,
        phone: result.phone,
        assignedSite: result.assignedSite,
      },
    });
  } catch (error) {
    console.error('Failed to convert ad call to customer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to convert' },
      { status: 500 }
    );
  }
}
