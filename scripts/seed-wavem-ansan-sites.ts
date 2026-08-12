/**
 * 웨이브엠 / 안산서희스타힐스6차 현장을 Site 테이블에 등록
 *
 * lib/constants/sites.ts 의 상수와 동일한 색/아이콘으로 맞춘다.
 * (useSites() 가 DB 목록과 상수를 병합하므로, 값이 다르면 DB 쪽이 이긴다)
 *
 * 사용법:
 *   pnpm tsx scripts/seed-wavem-ansan-sites.ts --dry-run
 *   pnpm tsx scripts/seed-wavem-ansan-sites.ts --execute
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NEW_SITES = [
  { name: '웨이브엠', color: 'sky', icon: '🌀' },           // bg-sky-50 / text-sky-700 / border-sky-200
  { name: '안산서희스타힐스6차', color: 'fuchsia', icon: '🏬' }, // bg-fuchsia-50 / text-fuchsia-700 / border-fuchsia-200
];
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

  const before = await prisma.site.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { name: true, color: true, icon: true, sortOrder: true, isActive: true },
  });
  console.log(`\n📋 현재 Site 테이블 (${before.length}개):`);
  before.forEach(s =>
    console.log(`  ${String(s.sortOrder).padStart(4)} ${s.icon} ${s.name} (${s.color})${s.isActive ? '' : ' [비활성]'}`),
  );

  const existingNames = new Set(before.map(s => s.name));
  const toCreate = NEW_SITES.filter(s => !existingNames.has(s.name));

  NEW_SITES.filter(s => existingNames.has(s.name)).forEach(s =>
    console.log(`\n⚠️  '${s.name}' 이(가) 이미 존재합니다. 건너뜁니다.`),
  );

  if (toCreate.length === 0) {
    console.log('\n✅ 새로 등록할 현장이 없습니다. 종료.');
    return;
  }

  // 기존 최대 sortOrder 뒤에 10 간격으로 순차 배치
  const maxOrder = before.reduce((m, s) => Math.max(m, s.sortOrder), 0);
  const planned = toCreate.map((s, i) => ({ ...s, sortOrder: maxOrder + (i + 1) * 10 }));

  console.log('\n🆕 등록 예정:');
  planned.forEach(s => console.log(`  ${String(s.sortOrder).padStart(4)} ${s.icon} ${s.name} (${s.color})`));

  if (isDryRun) {
    console.log('\n🚫 DRY-RUN: 실제 INSERT 안 함.');
    console.log('\n👉 실 등록: pnpm tsx scripts/seed-wavem-ansan-sites.ts --execute');
    return;
  }

  for (const site of planned) {
    const created = await prisma.site.create({
      data: {
        name: site.name,
        color: site.color,
        icon: site.icon,
        sortOrder: site.sortOrder,
        isActive: true,
        createdById: admin.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'CREATE_SITE',
        entity: 'Site',
        entityId: created.id,
        changes: JSON.parse(JSON.stringify(site)),
      },
    });

    console.log(`  ✓ '${site.name}' 등록 (id=${created.id})`);
  }

  const after = await prisma.site.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { name: true, color: true, icon: true, sortOrder: true },
  });
  console.log(`\n🔍 검증 — 등록 후 Site 테이블 (${after.length}개):`);
  after.forEach(s => console.log(`  ${String(s.sortOrder).padStart(4)} ${s.icon} ${s.name} (${s.color})`));

  console.log(`\n🎉 완료: ${planned.length}개 현장 등록`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ 오류:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
