/**
 * 야목역 서희스타힐스 그랜드힐 조합원모집 방문고객명단 → 공개DB 일괄 등록
 *
 * 엑셀 컬럼: 구분 | 방문 날짜(Excel serial) | 고객 명 | 연락처 | 비고
 *
 * 사용법:
 *   pnpm tsx scripts/import-yamok-public.ts --dry-run    # 미리보기
 *   pnpm tsx scripts/import-yamok-public.ts --execute    # 실제 등록
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { normalizePhone } from '../lib/utils/phone';

const prisma = new PrismaClient();

const EXCEL_FILE = '260509_야목역 서희스타힐스 그랜드힐 조합원모집 방문고객명단.xlsx';
const SITE_NAME = '야목역 서희스타힐스';
const ADMIN_USERNAME = 'admin';
const BATCH_SIZE = 500;

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');

if (!isDryRun && !isExecute) {
  console.error('❌ --dry-run 또는 --execute 옵션이 필요합니다.');
  process.exit(1);
}

function excelDateToISO(serial: unknown): string | null {
  if (typeof serial !== 'number' || !isFinite(serial)) return null;
  // Excel epoch: 1899-12-30 (Lotus 1-2-3 1900 leap year bug compatible)
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

type ParsedRow = {
  rowIndex: number;
  rawPhone: string;
  normalizedPhone: string;
  name: string | null;
  visitDate: string | null;
  remark: string | null;
};

async function main() {
  console.log(`🔍 모드: ${isDryRun ? 'DRY-RUN (실 등록 안 함)' : 'EXECUTE (실 등록)'}`);

  const admin = await prisma.user.findUnique({
    where: { username: ADMIN_USERNAME },
    select: { id: true, name: true, email: true },
  });
  if (!admin) throw new Error(`관리자 계정을 찾을 수 없습니다: ${ADMIN_USERNAME}`);
  console.log(`👤 관리자: ${admin.name} (${admin.email})`);

  const filePath = path.resolve(process.cwd(), EXCEL_FILE);
  console.log(`📂 엑셀 경로: ${filePath}`);

  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  type ExcelCell = string | number | boolean | null | undefined;
  const rows = XLSX.utils.sheet_to_json<ExcelCell[]>(sheet, { header: 1 });
  const dataRows = rows.slice(1); // 헤더 제외
  console.log(`📊 엑셀 데이터 행: ${dataRows.length}개\n`);

  const valid: ParsedRow[] = [];
  const invalid: { rowIndex: number; rawPhone: string; reason: string }[] = [];
  const seenPhones = new Set<string>();
  let intraExcelDups = 0;

  dataRows.forEach((row, i) => {
    const rawPhone = row[3]?.toString().trim() ?? '';
    if (!rawPhone) {
      invalid.push({ rowIndex: i + 2, rawPhone: '', reason: '연락처 없음' });
      return;
    }
    const normalized = normalizePhone(rawPhone);
    if (!normalized || normalized.length < 8 || normalized.length > 11) {
      invalid.push({ rowIndex: i + 2, rawPhone, reason: `유효하지 않은 자릿수 (${normalized.length}자리)` });
      return;
    }
    if (!normalized.match(/^[0-9]+$/)) {
      invalid.push({ rowIndex: i + 2, rawPhone, reason: '숫자 외 문자 포함' });
      return;
    }
    // 엑셀 내 같은 번호 중복 제거 — 첫 등장만 keep
    if (seenPhones.has(normalized)) {
      intraExcelDups++;
      return;
    }
    seenPhones.add(normalized);
    valid.push({
      rowIndex: i + 2,
      rawPhone,
      normalizedPhone: normalized,
      name: row[2]?.toString().trim() || null,
      visitDate: excelDateToISO(row[1]),
      remark: row[4]?.toString().trim() || null,
    });
  });

  console.log(`✅ 검증 통과: ${valid.length}건`);
  console.log(`❌ 검증 실패: ${invalid.length}건`);
  console.log(`🔁 엑셀 내 중복 제거: ${intraExcelDups}건`);
  if (invalid.length > 0) {
    console.log('  실패 샘플 (최대 5건):');
    invalid.slice(0, 5).forEach(v => console.log(`   row ${v.rowIndex}: "${v.rawPhone}" — ${v.reason}`));
  }

  // 중복 체크 — DB에 이미 존재하는 전화번호
  const phones = valid.map(v => v.normalizedPhone);
  const existing = await prisma.customer.findMany({
    where: { phone: { in: phones }, isDeleted: false },
    select: { phone: true, isPublic: true, assignedUserId: true, assignedSite: true },
  });

  const existingMap = new Map<string, typeof existing>();
  for (const e of existing) {
    const arr = existingMap.get(e.phone) ?? [];
    arr.push(e);
    existingMap.set(e.phone, arr);
  }

  const newRecords: ParsedRow[] = [];
  const duplicateInPublicSameSite: ParsedRow[] = [];
  const duplicateInPublicOtherSite: ParsedRow[] = [];
  const duplicateInPrivate: ParsedRow[] = [];

  for (const v of valid) {
    const matches = existingMap.get(v.normalizedPhone);
    if (!matches || matches.length === 0) {
      newRecords.push(v);
      continue;
    }
    const inPublic = matches.find(m => m.isPublic);
    if (inPublic) {
      if (inPublic.assignedSite === SITE_NAME) {
        duplicateInPublicSameSite.push(v);
      } else {
        duplicateInPublicOtherSite.push(v);
      }
    } else {
      duplicateInPrivate.push(v);
    }
  }

  console.log('\n📋 중복 분류:');
  console.log(`  🆕 신규 (등록 대상)              : ${newRecords.length}건`);
  console.log(`  🔁 이미 공개DB(${SITE_NAME})       : ${duplicateInPublicSameSite.length}건`);
  console.log(`  🔁 이미 공개DB(다른 현장)        : ${duplicateInPublicOtherSite.length}건`);
  console.log(`  🔒 이미 직원 보유 (비공개)        : ${duplicateInPrivate.length}건`);

  if (isDryRun) {
    console.log('\n🚫 DRY-RUN: 실제 INSERT 안 함. 결과만 출력하고 종료합니다.');
    console.log(`\n👉 실 등록하려면: pnpm tsx scripts/import-yamok-public.ts --execute`);
    return;
  }

  if (newRecords.length === 0) {
    console.log('\n⚠️  신규 등록 대상이 없습니다. 종료.');
    return;
  }

  // displayOrder 시작값 (현재 최소값보다 작게)
  const minOrder = await prisma.customer.aggregate({ _min: { displayOrder: true } });
  const startOrder = (minOrder._min.displayOrder ?? 0) - newRecords.length;

  console.log(`\n🔄 ${newRecords.length}건을 공개DB로 등록합니다... (청크 ${BATCH_SIZE}개)`);

  const now = new Date();
  let inserted = 0;
  for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
    const chunk = newRecords.slice(i, i + BATCH_SIZE);
    const data = chunk.map((r, idx) => {
      const visitNote = r.visitDate ? `[방문 ${r.visitDate}] ` : '';
      const remark = r.remark ?? '';
      const memo = (visitNote + remark).trim() || null;
      return {
        phone: r.normalizedPhone,
        name: r.name || `고객_${r.normalizedPhone.slice(-4)}`,
        memo: memo,
        assignedSite: SITE_NAME,
        isPublic: true,
        publicAt: now,
        publicById: admin.id,
        assignedUserId: null,
        assignedAt: null,
        displayOrder: startOrder + i + idx,
      } satisfies Prisma.CustomerCreateManyInput;
    });
    const result = await prisma.customer.createMany({ data });
    inserted += result.count;
    console.log(`  ✓ 청크 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newRecords.length / BATCH_SIZE)}: ${result.count}건 (누적 ${inserted})`);
  }

  // 검증
  const verified = await prisma.customer.count({
    where: {
      isPublic: true,
      assignedSite: SITE_NAME,
      isDeleted: false,
    },
  });
  console.log(`\n🔍 검증: 현재 공개DB에 등록된 ${SITE_NAME} 고객 = ${verified}명`);

  // AuditLog
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'BULK_IMPORT_PUBLIC',
      entity: 'Customer',
      entityId: `${inserted}건 (${SITE_NAME})`,
      changes: JSON.parse(JSON.stringify({
        file: EXCEL_FILE,
        site: SITE_NAME,
        totalExcelRows: dataRows.length,
        validRows: valid.length,
        inserted,
        skippedDuplicates: {
          publicSameSite: duplicateInPublicSameSite.length,
          publicOtherSite: duplicateInPublicOtherSite.length,
          privateAssigned: duplicateInPrivate.length,
        },
        invalidRows: invalid.length,
      })),
    },
  });
  console.log('📝 감사 로그 기록 완료');

  console.log(`\n🎉 완료: ${inserted}건을 ${SITE_NAME} 공개DB로 등록했습니다.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ 오류:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
