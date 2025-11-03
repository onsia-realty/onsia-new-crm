/**
 * OCR 이미지 데이터 추출 API
 * POST /api/ocr/extract
 */

import { NextRequest, NextResponse } from 'next/server';
import { ImageOCRExtractor } from '@/lib/services/ocrService';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
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

    // 업로드 디렉토리 생성
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await mkdir(uploadsDir, { recursive: true });

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
      return NextResponse.json({
        success: true,
        message: '데이터 추출 성공',
        data: result.data,
      });
    } else {
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
