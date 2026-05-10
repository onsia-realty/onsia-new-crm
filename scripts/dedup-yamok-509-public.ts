/**
 * 5월 9일 업로드된 야목역 서희스타힐스 공개DB(4,204명) 중
 * 전화번호 중복인 케이스를 1건만 남기고 나머지를 soft delete (isDeleted=true) 처리.
 *
 * 유지 기준: 같은 phone 그룹 내에서 createdAt ASC, id ASC 우선 (= 가장 먼저 등록된 1건)
 *
 * 사용법:
 *   pnpm tsx scripts/dedup-yamok-509-public.ts --dry-run    # 미리보기
 *   pnpm tsx scripts/dedup-yamok-509-public.ts --execute    # 실 처리
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SITE_NAME = '야목역 서희스타힐스';
const SINCE = new Date('2026-05-09T00:00:00Z');
const UNTIL = new Date('2026-05-10T00:00:00Z');
const ADMIN_USERNAME = 'admin';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');

if (!isDryRun && !isExecute) {
  console.error('❌ --dry-run 또는 --execute 옵션이 필요합니다.');
  process.exit(1);
}

async function main() {
  console.log(`🔍 모드: ${isDryRun ? 'DRY-RUN' : 'EXECUTE'}`);

  const admin = await prisma.user.findUnique({
    where: { username: ADMIN_USERNAME },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error(`관리자 계정을 찾을 수 없습니다: ${ADMIN_USERNAME}`);

  // 5/9 업로드 야목역 공개DB 전체 (살아있는 것만)
  const all = await prisma.customer.findMany({
    where: {
      isPublic: true,
      isDeleted: false,
      assignedSite: SITE_NAME,
      publicAt: { gte: SINCE, lt: UNTIL },
    },
    select: { id: true, phone: true, name: true, createdAt: true, displayOrder: true },
    orderBy: [{ phone: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  console.log(`📊 5/9 업로드 야목역 공개DB 총 ${all.length}건`);

  // phone별 그룹핑
  const groups = new Map<string, typeof all>();
  for (const c of all) {
    if (!groups.has(c.phone)) groups.set(c.phone, []);
    groups.get(c.phone)!.push(c);
  }
  const dupGroups = Array.from(groups.entries()).filter(([, list]) => list.length > 1);

  console.log(`🔁 중복 그룹 수: ${dupGroups.length}`);
  let totalExtras = 0;
  for (const [, list] of dupGroups) totalExtras += list.length - 1;
  console.log(`🗑️  삭제 대상(soft delete) 수: ${totalExtras}건`);

  // 유지/삭제 분류 — 첫 1건 keep, 나머지 delete
  const idsToDelete: string[] = [];
  for (const [, list] of dupGroups) {
    // orderBy로 이미 정렬되어 있어 list[0]이 keep, 나머지가 delete
    for (let i = 1; i < list.length; i++) {
      idsToDelete.push(list[i].id);
    }
  }

  // 샘플 출력
  console.log('\n=== 샘플 5건 (그룹) ===');
  dupGroups.slice(0, 5).forEach(([phone, list]) => {
    console.log(`  phone=${phone} (${list.length}건)`);
    list.forEach((c, i) => {
      const tag = i === 0 ? '✓ KEEP' : '✗ DEL ';
      console.log(`    ${tag} id=${c.id} name=${c.name} createdAt=${c.createdAt.toISOString()}`);
    });
  });

  if (isDryRun) {
    console.log('\n🚫 DRY-RUN: 실제 변경 없음. 종료.');
    console.log(`👉 실 처리: pnpm tsx scripts/dedup-yamok-509-public.ts --execute`);
    return;
  }

  if (idsToDelete.length === 0) {
    console.log('\n⚠️  삭제 대상이 없습니다. 종료.');
    return;
  }

  // soft delete 일괄 처리
  console.log(`\n🔄 ${idsToDelete.length}건 soft delete 처리 중...`);
  const result = await prisma.customer.updateMany({
    where: { id: { in: idsToDelete } },
    data: { isDeleted: true, updatedAt: new Date() },
  });
  console.log(`  ✓ ${result.count}건 isDeleted=true 처리 완료`);

  // AuditLog
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'BULK_DEDUP_SOFT_DELETE',
      entity: 'Customer',
      entityId: `${result.count}건 (5/9 야목역 공개DB 중복 정리)`,
      changes: JSON.parse(
        JSON.stringify({
          site: SITE_NAME,
          publicAtRange: [SINCE.toISOString(), UNTIL.toISOString()],
          dupGroups: dupGroups.length,
          softDeleted: result.count,
          keepStrategy: 'createdAt ASC, id ASC (first one of each phone group)',
        })
      ),
    },
  });
  console.log('📝 감사 로그 기록 완료');

  // 검증
  const after = await prisma.customer.count({
    where: {
      isPublic: true,
      isDeleted: false,
      assignedSite: SITE_NAME,
      publicAt: { gte: SINCE, lt: UNTIL },
    },
  });
  console.log(`\n🔍 검증: 처리 후 5/9 야목역 공개DB = ${after}명 (이전 ${all.length} - 삭제 ${result.count})`);

  console.log(`\n🎉 완료: ${result.count}건 중복 정리`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ 오류:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
