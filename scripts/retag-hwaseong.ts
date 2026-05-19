/**
 * 5/1 admin이 야목역 서희스타힐스로 잘못 태그한 화성시 민간임대 데이터를 재태그.
 *
 * 식별 조건 (모두 충족):
 *   1) isDeleted = false
 *   2) assignedSite = '야목역 서희스타힐스'
 *   3) createdAt KST 일자 = 2026-05-01
 *   4) publicById = admin
 *   5) memo가 비어있음
 *   6) 전화번호가 엑셀(260509_야목역...) 명단에 없음
 *
 * 사용법:
 *   pnpm tsx scripts/retag-hwaseong.ts --dry-run
 *   pnpm tsx scripts/retag-hwaseong.ts --execute
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { normalizePhone } from '../lib/utils/phone';

const prisma = new PrismaClient();
const FROM_SITE = '야목역 서희스타힐스';
const TO_SITE = '화성시 민간임대';
const EXCEL = '260509_야목역 서희스타힐스 그랜드힐 조합원모집 방문고객명단.xlsx';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');
if (!isDryRun && !isExecute) {
  console.error('❌ --dry-run 또는 --execute 옵션이 필요합니다.');
  process.exit(1);
}

async function main() {
  console.log(`🔍 모드: ${isDryRun ? 'DRY-RUN' : 'EXECUTE'}\n`);

  // 엑셀 번호 추출
  const wb = XLSX.readFile(path.resolve(process.cwd(), EXCEL));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  type Cell = string | number | boolean | null | undefined;
  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1 });
  const yamokPhones = new Set<string>();
  rows.slice(1).forEach((row) => {
    const raw = row[3]?.toString().trim() ?? '';
    if (!raw) return;
    const n = normalizePhone(raw);
    if (!n || n.length < 8 || n.length > 11 || !/^[0-9]+$/.test(n)) return;
    yamokPhones.add(n);
  });
  console.log(`📄 엑셀 유효 번호: ${yamokPhones.size}건`);

  const admin = await prisma.user.findUnique({
    where: { username: 'admin' },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error('admin 계정을 찾을 수 없습니다.');

  // 후보 추출
  const candidates = await prisma.$queryRaw<Array<{ id: string; phone: string; memo: string | null }>>`
    SELECT id, phone, memo
    FROM "Customer"
    WHERE "isDeleted" = false
      AND "assignedSite" = ${FROM_SITE}
      AND "publicById" = ${admin.id}
      AND (memo IS NULL OR trim(memo) = '')
      AND date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Seoul') = date '2026-05-01'
  `;
  console.log(`🎯 후보(5/1 admin·메모없음): ${candidates.length}건`);

  // 엑셀 번호 제외
  const targets = candidates.filter((c) => !yamokPhones.has(c.phone));
  const excludedByExcel = candidates.length - targets.length;
  console.log(`   ↳ 엑셀 번호 겹침 제외: ${excludedByExcel}건`);
  console.log(`   ↳ 재태그 대상: ${targets.length}건\n`);

  if (targets.length === 0) {
    console.log('⚠️  재태그 대상이 없습니다.');
    return;
  }

  if (isDryRun) {
    console.log('샘플 5건:');
    targets.slice(0, 5).forEach((t) => console.log(`   ${t.phone}`));
    console.log(`\n🚫 DRY-RUN: 실제 변경 안 함. 실행하려면 --execute`);
    return;
  }

  // 실제 변경
  console.log(`🔄 ${targets.length}건 assignedSite 변경: '${FROM_SITE}' → '${TO_SITE}'`);
  const ids = targets.map((t) => t.id);
  const result = await prisma.customer.updateMany({
    where: { id: { in: ids } },
    data: { assignedSite: TO_SITE },
  });
  console.log(`   ✓ 변경 완료: ${result.count}건`);

  // 감사 로그
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'RETAG_ASSIGNED_SITE',
      entity: 'Customer',
      entityId: `${result.count}건`,
      changes: JSON.parse(JSON.stringify({
        from: FROM_SITE,
        to: TO_SITE,
        criteria: '5/1 KST admin upload, empty memo, not in Excel 260509',
        count: result.count,
      })),
    },
  });
  console.log(`📝 감사 로그 기록 완료`);

  // 검증
  const yamokAfter = await prisma.customer.count({ where: { isDeleted: false, assignedSite: FROM_SITE } });
  const hwaseongAfter = await prisma.customer.count({ where: { isDeleted: false, assignedSite: TO_SITE } });
  const yamokPublic = await prisma.customer.count({ where: { isDeleted: false, assignedSite: FROM_SITE, isPublic: true } });
  const hwaseongPublic = await prisma.customer.count({ where: { isDeleted: false, assignedSite: TO_SITE, isPublic: true } });
  console.log(`\n📊 변경 후 현황`);
  console.log(`   ${FROM_SITE}: 전체 ${yamokAfter} / 공개DB ${yamokPublic}`);
  console.log(`   ${TO_SITE}: 전체 ${hwaseongAfter} / 공개DB ${hwaseongPublic}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error('❌ 오류:', e);
  await prisma.$disconnect();
  process.exit(1);
});
