/**
 * 파크힐 동탄 DB → 공개DB 일괄 등록
 *
 * 엑셀 특성 (주의):
 *   - 헤더 행이 없음. 1행부터 데이터.
 *   - 컬럼: A=이름 | B=연락처 | C=거주지역 | D=유입경로
 *   - B열 숫자 셀은 표시서식 `0\10\-####\-####` 로 앞의 "010"이 서식으로만 붙어 있어
 *     실제 값은 뒤 8자리뿐. normalizePhone()의 8자리→010 보정으로 처리됨.
 *
 * 사용법:
 *   pnpm tsx scripts/import-parkhill-public.ts --dry-run    # 미리보기
 *   pnpm tsx scripts/import-parkhill-public.ts --execute    # 실제 등록
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { normalizePhone } from '../lib/utils/phone';

const prisma = new PrismaClient();

const EXCEL_FILE = '파크힐 동탄 DB.xlsx';
const SITE_NAME = '파크힐 동탄';
const ADMIN_USERNAME = 'admin';
const BATCH_SIZE = 500;

/** 엑셀에서 이름이 비어있음을 뜻하는 플레이스홀더 */
const NAME_PLACEHOLDER = '미정';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');

if (!isDryRun && !isExecute) {
  console.error('❌ --dry-run 또는 --execute 옵션이 필요합니다.');
  process.exit(1);
}

type ParsedRow = {
  rowIndex: number;
  rawPhone: string;
  normalizedPhone: string;
  name: string | null;
  area: string | null;
  source: string | null;
};

/** 공개DB는 콜 대상이므로 휴대폰 번호(01x)만 허용한다. 02/070 유선은 제외. */
function isValidMobile(p: string): boolean {
  return /^01[016789][0-9]{7,8}$/.test(p);
}

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
  // 헤더 행이 없으므로 slice 하지 않는다.
  const dataRows = XLSX.utils.sheet_to_json<ExcelCell[]>(sheet, { header: 1, raw: true });
  console.log(`📊 엑셀 데이터 행: ${dataRows.length}개\n`);

  const valid: ParsedRow[] = [];
  const invalid: { rowIndex: number; rawPhone: string; reason: string }[] = [];
  const seenPhones = new Set<string>();
  let intraExcelDups = 0;

  dataRows.forEach((row, i) => {
    const rowIndex = i + 1; // 헤더 없음 → 엑셀 행번호 = i+1
    const rawPhone = row[1]?.toString().trim() ?? '';
    if (!rawPhone) {
      invalid.push({ rowIndex, rawPhone: '', reason: '연락처 없음' });
      return;
    }
    const normalized = normalizePhone(rawPhone);
    if (!isValidMobile(normalized)) {
      invalid.push({
        rowIndex,
        rawPhone,
        reason: `휴대폰 번호 아님 (정규화: ${normalized}, ${normalized.length}자리)`,
      });
      return;
    }
    if (seenPhones.has(normalized)) {
      intraExcelDups++;
      return;
    }
    seenPhones.add(normalized);

    const rawName = row[0]?.toString().trim() || '';
    valid.push({
      rowIndex,
      rawPhone,
      normalizedPhone: normalized,
      name: rawName && rawName !== NAME_PLACEHOLDER ? rawName : null,
      area: row[2]?.toString().trim() || null,
      source: row[3]?.toString().trim() || null,
    });
  });

  console.log(`✅ 검증 통과: ${valid.length}건`);
  console.log(`❌ 검증 실패: ${invalid.length}건`);
  console.log(`🔁 엑셀 내 중복 제거: ${intraExcelDups}건`);
  if (invalid.length > 0) {
    console.log('  실패 전체 목록:');
    invalid.forEach(v => console.log(`   row ${v.rowIndex}: "${v.rawPhone}" — ${v.reason}`));
  }

  // DB 중복 체크
  const phones = valid.map(v => v.normalizedPhone);
  const existing: { phone: string; isPublic: boolean; assignedUserId: string | null; assignedSite: string | null }[] = [];
  for (let i = 0; i < phones.length; i += 1000) {
    const chunk = phones.slice(i, i + 1000);
    const found = await prisma.customer.findMany({
      where: { phone: { in: chunk }, isDeleted: false },
      select: { phone: true, isPublic: true, assignedUserId: true, assignedSite: true },
    });
    existing.push(...found);
  }

  const existingMap = new Map<string, typeof existing>();
  for (const e of existing) {
    const arr = existingMap.get(e.phone) ?? [];
    arr.push(e);
    existingMap.set(e.phone, arr);
  }

  const newRecords: ParsedRow[] = [];
  const dupPublicSameSite: ParsedRow[] = [];
  const dupPublicOtherSite: ParsedRow[] = [];
  const dupPrivate: ParsedRow[] = [];

  for (const v of valid) {
    const matches = existingMap.get(v.normalizedPhone);
    if (!matches || matches.length === 0) {
      newRecords.push(v);
      continue;
    }
    const inPublic = matches.find(m => m.isPublic);
    if (inPublic) {
      if (inPublic.assignedSite === SITE_NAME) dupPublicSameSite.push(v);
      else dupPublicOtherSite.push(v);
    } else {
      dupPrivate.push(v);
    }
  }

  console.log('\n📋 중복 분류:');
  console.log(`  🆕 신규 (등록 대상)          : ${newRecords.length}건`);
  console.log(`  🔁 이미 공개DB(${SITE_NAME})  : ${dupPublicSameSite.length}건`);
  console.log(`  🔁 이미 공개DB(다른 현장)     : ${dupPublicOtherSite.length}건`);
  console.log(`  🔒 이미 직원 보유 (비공개)    : ${dupPrivate.length}건`);

  const withName = newRecords.filter(r => r.name).length;
  const withArea = newRecords.filter(r => r.area).length;
  const withSource = newRecords.filter(r => r.source).length;
  console.log(`\n📝 신규 ${newRecords.length}건 중 — 실명 ${withName}건 / 지역 ${withArea}건 / 경로 ${withSource}건`);

  if (isDryRun) {
    console.log('\n🚫 DRY-RUN: 실제 INSERT 안 함.');
    console.log(`\n👉 실 등록: pnpm tsx scripts/import-parkhill-public.ts --execute`);
    return;
  }

  if (newRecords.length === 0) {
    console.log('\n⚠️  신규 등록 대상이 없습니다. 종료.');
    return;
  }

  const minOrder = await prisma.customer.aggregate({ _min: { displayOrder: true } });
  const startOrder = (minOrder._min.displayOrder ?? 0) - newRecords.length;

  console.log(`\n🔄 ${newRecords.length}건을 공개DB로 등록합니다... (청크 ${BATCH_SIZE}개)`);

  const now = new Date();
  let inserted = 0;
  for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
    const chunk = newRecords.slice(i, i + BATCH_SIZE);
    const data = chunk.map((r, idx) => {
      const memo = [r.area, r.source].filter(Boolean).join(' / ') || null;
      return {
        phone: r.normalizedPhone,
        name: r.name || `고객_${r.normalizedPhone.slice(-4)}`,
        memo,
        residenceArea: r.area,
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

  const verified = await prisma.customer.count({
    where: { isPublic: true, assignedSite: SITE_NAME, isDeleted: false },
  });
  console.log(`\n🔍 검증: 현재 공개DB에 등록된 ${SITE_NAME} 고객 = ${verified}명`);

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
          publicSameSite: dupPublicSameSite.length,
          publicOtherSite: dupPublicOtherSite.length,
          privateAssigned: dupPrivate.length,
          intraExcel: intraExcelDups,
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
