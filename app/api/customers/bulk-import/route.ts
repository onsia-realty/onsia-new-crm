import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/utils/phone';
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit';
import * as XLSX from 'xlsx';

// Vercel Serverless Function Configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // 최대 60초 (Pro plan)

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 체크 - PENDING 제외 모두 대량 등록 가능
    if (session.user.role === 'PENDING') {
      return NextResponse.json(
        { error: '승인 대기 중입니다. 관리자 승인 후 이용 가능합니다.' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const assignedSite = formData.get('assignedSite') as string || '';

    if (!file) {
      return NextResponse.json(
        { error: '파일이 없습니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (4MB)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: '파일 크기는 4MB를 초과할 수 없습니다.' },
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
    type ExcelRow = (string | number | null | undefined)[]
    const rows = (jsonData.slice(1) as ExcelRow[]).filter((row) => row[0]); // 전화번호가 있는 행만
    
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

    // 행 제한 (ADMIN은 무제한, 일반 사용자는 최대 1000개)
    const MAX_ROWS = 1000;
    const isAdmin = session.user.role === 'ADMIN';
    if (!isAdmin && rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `한 번에 최대 ${MAX_ROWS}개까지만 등록할 수 있습니다.` },
        { status: 400 }
      );
    }

    // 데이터 준비 및 검증
    const validData = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const phone = row[0]?.toString().trim();
      const name = row[1]?.toString().trim() || null;
      const memo = row[2]?.toString().trim() || null;

      if (!phone) {
        failedCount++;
        errors.push({
          row: i + 2,
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

      const normalizedPhone = normalizePhone(phone);

      // 유효한 전화번호인지 체크
      if (!normalizedPhone.match(/^(0[0-9]{1,2}|1[0-9]{3})[0-9]{6,8}$/)) {
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

      validData.push({
        rowIndex: i,
        phone,
        normalizedPhone,
        name,
        memo,
      });
    }

    // 배치로 중복 체크 (성능 개선)
    const normalizedPhones = validData.map(d => d.normalizedPhone);
    const existingCustomers = await prisma.customer.findMany({
      where: {
        phone: { in: normalizedPhones },
      },
      select: { phone: true },
    });

    const existingPhoneSet = new Set(existingCustomers.map(c => c.phone));

    // 배치 생성을 위한 데이터 준비
    const customersToCreate = [];

    for (const data of validData) {
      if (existingPhoneSet.has(data.normalizedPhone)) {
        duplicateCount++;
        results.push({
          phone: data.phone,
          name: data.name,
          status: 'duplicate',
          message: '이미 등록된 번호',
        });
        continue;
      }

      customersToCreate.push({
        phone: data.normalizedPhone,
        name: data.name || `고객_${data.normalizedPhone.slice(-4)}`,
        memo: data.memo,
        assignedUserId: session.user.id,
        assignedAt: new Date(),
        assignedSite: assignedSite || null,
      });

      results.push({
        phone: data.phone,
        name: data.name,
        status: 'success',
        message: '등록 성공',
      });
    }

    // 배치로 고객 생성 (성능 개선) - 이전의 안정적인 방식으로 복원
    if (customersToCreate.length > 0) {
      try {
        // 1단계: 먼저 고객들을 배치로 생성
        await prisma.customer.createMany({
          data: customersToCreate.map(data => ({
            phone: data.phone,
            name: data.name,
            assignedUserId: data.assignedUserId,
            assignedAt: data.assignedAt,
            assignedSite: data.assignedSite,
            memo: '', // memo는 비워두고 통화기록으로 저장
          })),
          skipDuplicates: true, // 중복 방지
        });
        successCount = customersToCreate.length;

        // 2단계: 생성된 고객들의 ID를 가져와서 통화기록 생성
        const createdCustomers = await prisma.customer.findMany({
          where: {
            phone: {
              in: customersToCreate.map(c => c.phone),
            },
            assignedUserId: session.user.id,
          },
          select: {
            id: true,
            phone: true,
          },
        });

        // phone으로 매핑
        const phoneToIdMap = new Map(createdCustomers.map(c => [c.phone, c.id]));

        // 3단계: 메모가 있는 고객들의 통화기록 생성
        const callLogsToCreate = customersToCreate
          .filter(data => data.memo && data.memo.trim())
          .map(data => ({
            customerId: phoneToIdMap.get(data.phone)!,
            userId: session.user.id,
            content: data.memo!,
            note: '대량 등록 시 자동 생성',
          }))
          .filter(log => log.customerId); // customerId가 있는 것만

        if (callLogsToCreate.length > 0) {
          try {
            await prisma.callLog.createMany({
              data: callLogsToCreate,
              skipDuplicates: true,
            });
          } catch (error) {
            console.error('통화기록 생성 중 오류 (고객은 정상 등록됨):', error);
            // 통화기록 생성 실패해도 고객 등록은 성공으로 처리
          }
        }
      } catch (error) {
        console.error('Batch create error:', error);
        // 배치 생성 실패 시 개별 처리로 폴백
        for (const customerData of customersToCreate) {
          try {
            const customer = await prisma.customer.create({
              data: {
                phone: customerData.phone,
                name: customerData.name,
                assignedUserId: customerData.assignedUserId,
                assignedAt: customerData.assignedAt,
                assignedSite: customerData.assignedSite,
                memo: '',
              }
            });

            // 메모가 있으면 통화기록으로 저장
            if (customerData.memo && customerData.memo.trim()) {
              try {
                await prisma.callLog.create({
                  data: {
                    customerId: customer.id,
                    userId: session.user.id,
                    content: customerData.memo,
                    note: '대량 등록 시 자동 생성',
                  },
                });
              } catch (callLogError) {
                console.error('통화기록 생성 실패:', callLogError);
              }
            }

            successCount++;
          } catch (individualError) {
            console.error('Individual create error for', customerData.phone, ':', individualError);
            failedCount++;
            errors.push({
              row: 0,
              phone: customerData.phone,
              error: individualError instanceof Error ? individualError.message : '등록 실패'
            });
            // results에서 해당 고객의 status를 error로 변경
            const resultIndex = results.findIndex(r => r.phone === customerData.phone);
            if (resultIndex !== -1) {
              results[resultIndex].status = 'error';
              results[resultIndex].message = individualError instanceof Error ? individualError.message : '등록 실패';
            }
          }
        }
      }
    }

    // 감사 로그
    await createAuditLog({
      userId: session.user.id,
      action: 'CREATE',
      entity: 'Customer',
      changes: {
        total: rows.length,
        success: successCount,
        duplicates: duplicateCount,
        failed: failedCount,
        fileName: file.name,
        assignedSite: assignedSite || null,
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({
      success: successCount,
      total: rows.length,
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