import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// KST 기준 2026-08-13 00:00 ~ 현재
const FROM = new Date('2026-08-12T15:00:00.000Z'); // KST 8/13 00:00
const TO = new Date('2026-08-19T14:59:59.999Z'); // KST 8/19 23:59

const kst = (d: Date) =>
  new Date(d.getTime() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);

async function main() {
  const users = await prisma.user.findMany({
    where: { name: { contains: '윤상' } },
    select: {
      id: true,
      username: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      joinedAt: true,
      lastLoginAt: true,
    },
  });

  if (users.length === 0) {
    console.log('❌ 이름에 "윤상"이 포함된 사용자를 찾지 못했습니다.');
    const all = await prisma.user.findMany({
      select: { username: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
    console.log('전체 사용자:', all.map((u) => `${u.name}(${u.username})`).join(', '));
    return;
  }

  for (const u of users) {
    console.log('='.repeat(70));
    console.log(`👤 ${u.name} (${u.username}) | ${u.role} | active=${u.isActive}`);
    console.log(`   입사/가입일: ${u.joinedAt ? kst(u.joinedAt) + ' KST' : '(없음)'}`);
    console.log(`   최종 로그인: ${u.lastLoginAt ? kst(u.lastLoginAt) + ' KST' : '(기록없음)'}`);
    console.log('='.repeat(70));

    // 1) 감사 로그
    const logs = await prisma.auditLog.findMany({
      where: { userId: u.id, createdAt: { gte: FROM, lte: TO } },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`\n📋 감사로그 (8/13~8/19): 총 ${logs.length}건`);

    // 액션별 집계
    const byAction = new Map<string, number>();
    const byDay = new Map<string, number>();
    const ips = new Map<string, number>();
    const agents = new Map<string, number>();
    for (const l of logs) {
      const k = `${l.action}:${l.entity}`;
      byAction.set(k, (byAction.get(k) || 0) + 1);
      const day = kst(l.createdAt).slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + 1);
      if (l.ipAddress) ips.set(l.ipAddress, (ips.get(l.ipAddress) || 0) + 1);
      if (l.userAgent) agents.set(l.userAgent, (agents.get(l.userAgent) || 0) + 1);
    }

    console.log('\n  [액션별]');
    [...byAction.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`    ${k.padEnd(35)} ${v}건`));

    console.log('\n  [일자별]');
    [...byDay.entries()].sort().forEach(([k, v]) => console.log(`    ${k}  ${v}건`));

    console.log('\n  [접속 IP]');
    [...ips.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`    ${k.padEnd(40)} ${v}건`));

    console.log('\n  [User-Agent]');
    [...agents.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([k, v]) => console.log(`    ${v}건  ${k.slice(0, 110)}`));

    // 시간대별 분포 (심야 접근 탐지)
    const byHour = new Array(24).fill(0);
    for (const l of logs) byHour[Number(kst(l.createdAt).slice(11, 13))]++;
    console.log('\n  [시간대별 KST]');
    console.log(
      '    ' +
        byHour.map((v, i) => (v ? `${String(i).padStart(2, '0')}시:${v}` : '')).filter(Boolean).join('  ')
    );

    // 상세 타임라인 (전체)
    console.log('\n  [상세 타임라인]');
    for (const l of logs) {
      const ch = l.changes ? JSON.stringify(l.changes).slice(0, 160) : '';
      console.log(
        `    ${kst(l.createdAt)} | ${l.action}/${l.entity} | ${l.entityId ?? '-'} | ip=${l.ipAddress ?? '-'} ${ch}`
      );
    }

    // 2) 공개DB 클레임 (DB 가져가기 핵심 지표)
    const claimed = await prisma.customer.findMany({
      where: {
        assignedUserId: u.id,
        updatedAt: { gte: FROM, lte: TO },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        assignedSite: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
        assignedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
    });
    console.log(`\n📇 담당 고객 중 기간내 변경/획득: ${claimed.length}건`);
    const claimByDay = new Map<string, number>();
    claimed.forEach((c) => {
      const d = kst(c.updatedAt).slice(0, 10);
      claimByDay.set(d, (claimByDay.get(d) || 0) + 1);
    });
    [...claimByDay.entries()].sort().forEach(([k, v]) => console.log(`    ${k}  ${v}건`));

    // 3) 기간내 본인에게 배정(클레임)된 고객
    const assigned = await prisma.customer.count({
      where: { assignedUserId: u.id, assignedAt: { gte: FROM, lte: TO } },
    });
    console.log(`\n➕ 기간내 본인에게 배정/클레임된 고객: ${assigned}건`);

    // 3-b) 전 기간 감사로그 최근 활동 (언제까지 활동했나)
    const lastLogs = await prisma.auditLog.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    console.log(`\n🕰 전 기간 최근 감사로그 20건 (활동 종료 시점 확인):`);
    if (lastLogs.length === 0) console.log('    (감사로그 자체가 전혀 없음)');
    lastLogs.forEach((l) =>
      console.log(
        `    ${kst(l.createdAt)} | ${l.action}/${l.entity} | ip=${l.ipAddress ?? '-'} | ${(l.userAgent ?? '').slice(0, 60)}`
      )
    );

    // 4) 통화기록
    const calls = await prisma.callLog.count({
      where: { userId: u.id, createdAt: { gte: FROM, lte: TO } },
    });
    console.log(`📞 기간내 통화기록 작성: ${calls}건`);

    // 5) 전체 담당 고객 수
    const totalOwned = await prisma.customer.count({
      where: { assignedUserId: u.id, isDeleted: false },
    });
    console.log(`📊 현재 담당 고객 총계: ${totalOwned}건`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
