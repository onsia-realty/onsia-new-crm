/**
 * OCR 이미지 데이터 추출 API
 * POST /api/ocr/extract
 */

import { NextRequest, NextResponse } from 'next/server';
import { ImageOCRExtractor } from '@/lib/services/ocrService';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return NextResponse.json(
        {
          success: false,
          error: '이미지 파일을 업로드해주세요.',
        },
        { status: 400 }
      );
    }

    // Vercel 서버리스 환경에서는 /tmp만 쓰기 가능
    const uploadsDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'uploads');

    // 로컬 환경에서만 디렉토리 생성
    if (!process.env.VERCEL) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // 파일 저장
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = `image-${uniqueSuffix}${path.extname(image.name)}`;
    const filepath = path.join(uploadsDir, filename);

    await writeFile(filepath, buffer);
    console.log(`이미지 처리 시작: ${filename}`);

    // OCR 추출
    const ocrExtractor = new ImageOCRExtractor();
    const result = await ocrExtractor.extractAllData(filepath);
    await ocrExtractor.cleanup();

    if (result.success) {
      console.log('추출된 데이터:', result.data);

      // 감사 로그 기록 (업로드 카운트 추적용)
      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'OCR_IMAGE_UPLOAD',
            entity: 'OCR',
            entityId: image.name,
            changes: {
              fileName: image.name,
              phoneNumber: result.data.phoneNumber,
              address: result.data.address,
              method: result.data.method,
            },
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
          },
        });
      } catch (dbError) {
        console.error('Audit log 저장 실패:', dbError);
        // DB 저장 실패해도 OCR 결과는 반환
      }

      return NextResponse.json({
        success: true,
        message: '데이터 추출 성공',
        data: result.data,
      });
    } else{
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('❌ OCR 처리 실패:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'OCR 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
