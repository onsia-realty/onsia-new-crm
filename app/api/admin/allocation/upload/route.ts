import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkPermission, createAuditLog } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/utils/phone';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 확인
    const canAllocate = await checkPermission('customers', 'allocate');
    if (!canAllocate) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
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
    const rows = (jsonData.slice(1) as ExcelRow[]).filter((row) => row[0]); // 이름이 있는 행만

    if (rows.length === 0) {
      return NextResponse.json(
        { error: '등록할 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // 행 제한 (한 번에 최대 500개)
    const MAX_ROWS = 500;
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `한 번에 최대 ${MAX_ROWS}개까지만 등록할 수 있습니다.` },
        { status: 400 }
      );
    }

    let created = 0;
    let updated = 0;
    let allocated = 0;
    const errors: { row: number; error: string }[] = [];

    // 트랜잭션으로 처리
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row[0]?.toString().trim();
        const phone = row[1]?.toString().trim();
        const email = row[2]?.toString().trim() || null;
        const address = row[3]?.toString().trim() || null;
        const assignToEmail = row[4]?.toString().trim();

        if (!name || !phone) {
          errors.push({
            row: i + 2,
            error: '이름과 전화번호는 필수입니다.'
          });
          continue;
        }

        // 전화번호 정규화
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
          errors.push({
            row: i + 2,
            error: '올바른 전화번호 형식이 아닙니다.'
          });
          continue;
        }

        try {
          // 기존 고객 확인
          let customer = await tx.customer.findFirst({
            where: { phone: normalizedPhone }
          });

          if (customer) {
            // 기존 고객 정보 업데이트
            customer = await tx.customer.update({
              where: { id: customer.id },
              data: {
                name: name || customer.name,
                email: email || customer.email,
                address: address || customer.address,
              }
            });
            updated++;
          } else {
            // 새 고객 생성
            customer = await tx.customer.create({
              data: {
                name,
                phone: normalizedPhone,
                email,
                address,
              }
            });
            created++;
          }

          // 담당자 배분 처리
          if (assignToEmail) {
            const targetUser = await tx.user.findUnique({
              where: { email: assignToEmail }
            });

            if (targetUser) {
              // 기존 담당자 확인
              const previousAssignedUserId = customer.assignedUserId;

              // 고객 담당자 업데이트
              await tx.customer.update({
                where: { id: customer.id },
                data: {
                  assignedUserId: targetUser.id,
                  assignedAt: new Date()
                }
              });

              // 배분 기록 생성
              await tx.customerAllocation.create({
                data: {
                  customerId: customer.id,
                  fromUserId: previousAssignedUserId,
                  toUserId: targetUser.id,
                  allocatedById: session.user.id,
                  reason: '엑셀 업로드를 통한 일괄 배분'
                }
              });

              allocated++;
            } else {
              errors.push({
                row: i + 2,
                error: `담당자 이메일(${assignToEmail})을 찾을 수 없습니다.`
              });
            }
          }
        } catch (error) {
          console.error(`Row ${i + 2} processing error:`, error);
          errors.push({
            row: i + 2,
            error: '처리 중 오류가 발생했습니다.'
          });
        }
      }
    });

    // 감사 로그
    await createAuditLog(
      session.user.id,
      'BULK_ALLOCATE_CUSTOMERS',
      'Customer',
      undefined,
      {
        totalRows: rows.length,
        created,
        updated,
        allocated,
        errors: errors.length
      },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return NextResponse.json({
      success: true,
      created,
      updated,
      allocated,
      errors: errors.length > 0 ? errors : undefined,
      message: `${created}명 생성, ${updated}명 업데이트, ${allocated}명 배분 완료`
    });

  } catch (error) {
    console.error('Failed to process upload:', error);
    return NextResponse.json(
      { error: '파일 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}