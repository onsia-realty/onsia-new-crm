import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const kst = (d: Date) =>
  new Date(d.getTime() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);

async function main() {
  const u = await prisma.user.findFirst({ where: { username: 'yunsang1238' } });
  if (!u) return console.log('not found');

  // 권한 확인
  const perms = await prisma.permission.findMany({ where: { userId: u.id } }).catch(() => null);
  console.log('🔐 개별 권한 부여 내역:');
  if (!perms || perms.length === 0) console.log('   (없음 - 역할 기본값만)');
  else perms.forEach((p) => console.log('   ', JSON.stringify(p)));

  // 최근 90일 감사로그
  const since = new Date('2026-05-21T00:00:00Z');
  const logs = await prisma.auditLog.findMany({
    where: { userId: u.id, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`\n📋 최근 90일 감사로그: ${logs.length}건`);
  const byDay = new Map<string, Map<string, number>>();
  for (const l of logs) {
    const d = kst(l.createdAt).slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, new Map());
    const m = byDay.get(d)!;
    m.set(l.action, (m.get(l.action) || 0) + 1);
  }
  [...byDay.entries()].sort().forEach(([d, m]) => {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    console.log(
      `   ${d}  총${String(total).padStart(3)}건  ${[...m.entries()].map(([k, v]) => `${k}×${v}`).join(', ')}`
    );
  });

  // IP 목록
  const ips = new Map<string, number>();
  logs.forEach((l) => l.ipAddress && ips.set(l.ipAddress, (ips.get(l.ipAddress) || 0) + 1));
  console.log('\n🌐 접속 IP (90일):');
  [...ips.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${k}  ${v}건`));

  // 담당고객 배정 시점 분포
  const owned = await prisma.customer.findMany({
    where: { assignedUserId: u.id, isDeleted: false },
    select: { assignedAt: true, createdAt: true, assignedSite: true, isPublic: true },
  });
  console.log(`\n📊 담당 고객 ${owned.length}건 — 배정 월별 분포:`);
  const byMonth = new Map<string, number>();
  owned.forEach((c) => {
    const d = c.assignedAt ? kst(c.assignedAt).slice(0, 7) : '(assignedAt 없음)';
    byMonth.set(d, (byMonth.get(d) || 0) + 1);
  });
  [...byMonth.entries()].sort().forEach(([k, v]) => console.log(`   ${k}  ${v}건`));

  console.log('\n🏗 현장별 분포 (상위 15):');
  const bySite = new Map<string, number>();
  owned.forEach((c) => bySite.set(c.assignedSite || '(없음)', (bySite.get(c.assignedSite || '(없음)') || 0) + 1));
  [...bySite.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([k, v]) => console.log(`   ${k.padEnd(25)} ${v}건`));

  // 다른 직원 대비 담당 고객 수
  const all = await prisma.user.findMany({
    where: { isActive: true },
    select: { name: true, username: true, role: true, _count: { select: { customers: true } } },
  });
  console.log('\n👥 전 직원 담당 고객 수 (상위 15):');
  all
    .sort((a, b) => b._count.customers - a._count.customers)
    .slice(0, 15)
    .forEach((x) => console.log(`   ${(x.name + '(' + x.role + ')').padEnd(28)} ${x._count.customers}건`));

  // 통화기록 90일
  const calls = await prisma.callLog.findMany({
    where: { userId: u.id, createdAt: { gte: since } },
    select: { createdAt: true },
  });
  console.log(`\n📞 최근 90일 통화기록: ${calls.length}건`);
  const cByDay = new Map<string, number>();
  calls.forEach((c) => {
    const d = kst(c.createdAt).slice(0, 10);
    cByDay.set(d, (cByDay.get(d) || 0) + 1);
  });
  [...cByDay.entries()].sort().forEach(([k, v]) => console.log(`   ${k}  ${v}건`));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
