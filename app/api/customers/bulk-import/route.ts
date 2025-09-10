import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/utils/phone';
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 - ADMIN, HEAD, TEAM_LEADER만 대량 등록 가능
    if (!['ADMIN', 'HEAD', 'TEAM_LEADER'].includes(session.user.role)) {
      return NextResponse.json(
        { error: '대량 등록 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: '파일이 없습니다.' },
        { status: 400 }
      );
    }

    // 파일을 ArrayBuffer로 읽기
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    // 엑셀 파일 파싱
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    // 헤더 제외하고 데이터 추출
    const rows = jsonData.slice(1).filter((row: any) => row[0]); // 전화번호가 있는 행만
    
    if (rows.length === 0) {
      return NextResponse.json(
        { error: '등록할 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    const results = [];
    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    const errors = [];

    // 각 행 처리
    for (let i = 0; i < rows.length; i++) {
      const row: any = rows[i];
      const phone = row[0]?.toString().trim();
      const name = row[1]?.toString().trim() || null;
      const memo = row[2]?.toString().trim() || null;
      
      if (!phone) {
        failedCount++;
        errors.push({
          row: i + 2, // 엑셀 행 번호 (헤더 포함)
          phone: '',
          error: '전화번호가 없습니다',
        });
        results.push({
          phone: '',
          name,
          status: 'error',
          message: '전화번호가 없습니다',
        });
        continue;
      }

      try {
        const normalizedPhone = normalizePhone(phone);
        
        // 유효한 전화번호인지 체크
        if (!normalizedPhone.match(/^01[0-9]{8,9}$/)) {
          failedCount++;
          errors.push({
            row: i + 2,
            phone,
            error: '유효하지 않은 전화번호 형식',
          });
          results.push({
            phone,
            name,
            status: 'error',
            message: '유효하지 않은 전화번호 형식',
          });
          continue;
        }

        // 중복 체크
        const existingCustomer = await prisma.customer.findUnique({
          where: { phone: normalizedPhone },
        });

        if (existingCustomer) {
          duplicateCount++;
          results.push({
            phone,
            name,
            status: 'duplicate',
            message: '이미 등록된 번호',
          });
          continue;
        }

        // 고객 생성
        await prisma.customer.create({
          data: {
            phone: normalizedPhone,
            name: name || `고객_${normalizedPhone.slice(-4)}`,
            memo: memo,
            assignedUserId: session.user.id,
            assignedAt: new Date(),
          },
        });

        successCount++;
        results.push({
          phone,
          name,
          status: 'success',
          message: '등록 성공',
        });
      } catch (error) {
        failedCount++;
        errors.push({
          row: i + 2,
          phone,
          error: '등록 중 오류 발생',
        });
        results.push({
          phone,
          name,
          status: 'error',
          message: '등록 중 오류 발생',
        });
      }
    }

    // 감사 로그
    await createAuditLog({
      userId: session.user.id,
      action: 'BULK_IMPORT',
      entity: 'Customer',
      changes: {
        total: rows.length,
        success: successCount,
        duplicates: duplicateCount,
        failed: failedCount,
        fileName: file.name,
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({
      success: true,
      total: rows.length,
      success: successCount,
      duplicates: duplicateCount,
      failed: failedCount,
      errors,
      results,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      { error: '파일 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}