import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit';

// POST /api/customers/[id]/mark-disconnected - 결번 처리
// 동작:
//   1) 해당 고객 phone을 블랙리스트에 등록 (reason='결번')
//   2) 같은 phone의 모든 공개DB 레코드 소프트 삭제 → 공개DB에서 자동 제외
//   3) 통화기록에 '결번 처리' 추가
// 주의: 다른 직원이 이미 본인 DB로 가져간 같은 phone의 레코드는 건드리지 않음 (블랙 표시만 뜸)
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

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id },
        select: { id: true, phone: true, name: true, isDeleted: true },
      });
      if (!customer || customer.isDeleted) {
        throw new Error('고객을 찾을 수 없습니다.');
      }

      // 1. Blacklist 등록/갱신 (reason='결번')
      const existingBl = await tx.blacklist.findUnique({
        where: { phone: customer.phone },
      });
      if (existingBl) {
        await tx.blacklist.update({
          where: { id: existingBl.id },
          data: {
            isActive: true,
            reason: '결번',
            name: customer.name || existingBl.name,
            registeredById: session.user.id,
          },
        });
      } else {
        await tx.blacklist.create({
          data: {
            phone: customer.phone,
            name: customer.name || null,
            reason: '결번',
            registeredById: session.user.id,
          },
        });
      }

      // 2. 같은 phone의 공개DB 레코드 전체 소프트 삭제 (전략 A: 공개DB만)
      const deleteResult = await tx.customer.updateMany({
        where: {
          phone: customer.phone,
          isPublic: true,
          isDeleted: false,
        },
        data: { isDeleted: true },
      });

      // 3. 통화기록에 '결번 처리' 추가
      await tx.callLog.create({
        data: {
          customerId: id,
          userId: session.user.id,
          content: '결번 처리',
        },
      });

      return {
        phone: customer.phone,
        deletedFromPublic: deleteResult.count,
      };
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'MARK_DISCONNECTED',
      entity: 'Customer',
      entityId: id,
      changes: result,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({
      success: true,
      message: `결번 처리 완료. 블랙리스트에 등록되었고, 공개DB에서 ${result.deletedFromPublic}건 제외되었습니다.`,
      ...result,
    });
  } catch (error) {
    console.error('Failed to mark disconnected:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '결번 처리에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
