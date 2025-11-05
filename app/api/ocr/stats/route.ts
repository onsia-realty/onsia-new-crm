/**
 * OCR 업로드 통계 API
 * GET /api/ocr/stats - 오늘 업로드 건수 조회
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const DAILY_LIMIT = 50;

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 오늘 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 오늘 OCR 이미지 업로드 건수 (AuditLog에서 OCR_IMAGE_UPLOAD 액션 카운트)
    const todayCount = await prisma.auditLog.count({
      where: {
        userId: session.user.id,
        action: 'OCR_IMAGE_UPLOAD',
        createdAt: {
          gte: today,
        },
      },
    });

    return NextResponse.json({
      success: true,
      todayCount,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - todayCount),
    });
  } catch (error: unknown) {
    console.error('OCR 통계 조회 오류:', error);
    return NextResponse.json(
      { error: 'OCR 통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
