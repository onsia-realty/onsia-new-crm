import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit';

// POST /api/customers/[id]/mark-material-sent - 자료 발송 토글
// body: { sent?: boolean } — 생략 시 토글, true/false 명시 시 해당 값으로 설정
// 동작:
//   1) Customer.materialSent 토글 (또는 명시 값으로 설정)
//   2) materialSentAt 업데이트
//   3) 통화기록(CallLog)에 '자료 발송' 또는 '자료 발송 해제' 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // body는 선택사항 — sent를 명시하면 그 값으로 설정, 생략하면 토글
    let explicitSent: boolean | undefined;
    try {
      const body = await req.json();
      if (typeof body?.sent === 'boolean') explicitSent = body.sent;
    } catch {
      // body 없음 → 토글
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id },
        select: { id: true, materialSent: true, isDeleted: true, name: true },
      });
      if (!customer || customer.isDeleted) {
        throw new Error('고객을 찾을 수 없습니다.');
      }

      const nextSent = explicitSent !== undefined ? explicitSent : !customer.materialSent;

      const updated = await tx.customer.update({
        where: { id },
        data: {
          materialSent: nextSent,
          materialSentAt: nextSent ? new Date() : null,
        },
        select: { id: true, materialSent: true, materialSentAt: true },
      });

      await tx.callLog.create({
        data: {
          customerId: id,
          userId: session.user.id,
          content: nextSent ? '자료 발송' : '자료 발송 해제',
        },
      });

      return { previous: customer.materialSent, current: updated.materialSent, materialSentAt: updated.materialSentAt };
    });

    await createAuditLog({
      userId: session.user.id,
      action: result.current ? 'MARK_MATERIAL_SENT' : 'UNMARK_MATERIAL_SENT',
      entity: 'Customer',
      entityId: id,
      changes: result,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({
      success: true,
      message: result.current ? '자료 발송으로 표시되었습니다.' : '자료 발송 표시가 해제되었습니다.',
      materialSent: result.current,
      materialSentAt: result.materialSentAt,
    });
  } catch (error) {
    console.error('Failed to mark material sent:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '자료 발송 처리에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
