import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
      approvedAt: true,
    },
  });

  if (users.length === 0) {
    console.log('❌ 이름에 "윤상"이 포함된 사용자 없음');
    const all = await prisma.user.findMany({
      select: { username: true, name: true, role: true, isActive: true },
      orderBy: { name: 'asc' },
    });
    console.log(all.map((u) => `${u.name}(${u.username}/${u.role}/active=${u.isActive})`).join(', '));
    return;
  }

  for (const u of users) {
    console.log('='.repeat(76));
    console.log(`👤 ${u.name} (${u.username}) | ${u.role} | active=${u.isActive}`);
    console.log(`   승인일: ${u.approvedAt ? kst(u.approvedAt) : '-'} KST`);
    console.log(`   입사/가입일: ${u.joinedAt ? kst(u.joinedAt) : '(없음)'} KST`);
    console.log(`   최종 로그인(lastLoginAt): ${u.lastLoginAt ? kst(u.lastLoginAt) + ' KST' : '(기록없음)'}`);
    console.log('='.repeat(76));

    // 전체 감사로그 요약
    const total = await prisma.auditLog.count({ where: { userId: u.id } });
    const first = await prisma.auditLog.findFirst({
      where: { userId: u.id },
      orderBy: { createdAt: 'asc' },
    });
    const last = await prisma.auditLog.findFirst({
      where: { userId: u.id },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`\n📋 감사로그 전체 ${total}건`);
    if (first) console.log(`   최초: ${kst(first.createdAt)} KST | ${first.action}/${first.entity}`);
    if (last) console.log(`   최종: ${kst(last.createdAt)} KST | ${last.action}/${last.entity} | ip=${last.ipAddress ?? '-'}`);

    // LOGIN 로그
    const logins = await prisma.auditLog.findMany({
      where: { userId: u.id, action: { contains: 'LOGIN' } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    console.log(`\n🔑 로그인 기록: ${logins.length}건 (최근 100)`);
    logins.forEach((l) =>
      console.log(
        `   ${kst(l.createdAt)} | ${l.action} | ip=${l.ipAddress ?? '-'} | ${(l.userAgent ?? '').slice(0, 70)}`
      )
    );

    // 최근 60일 활동
    const from = new Date(Date.now() - 60 * 24 * 3600 * 1000);
    const recent = await prisma.auditLog.findMany({
      where: { userId: u.id, createdAt: { gte: from } },
      orderBy: { createdAt: 'asc' },
    });
    const byDay = new Map<string, number>();
    const ips = new Map<string, number>();
    const agents = new Map<string, number>();
    const byAction = new Map<string, number>();
    for (const l of recent) {
      const d = kst(l.createdAt).slice(0, 10);
      byDay.set(d, (byDay.get(d) || 0) + 1);
      if (l.ipAddress) ips.set(l.ipAddress, (ips.get(l.ipAddress) || 0) + 1);
      if (l.userAgent) agents.set(l.userAgent, (agents.get(l.userAgent) || 0) + 1);
      const k = `${l.action}:${l.entity}`;
      byAction.set(k, (byAction.get(k) || 0) + 1);
    }
    console.log(`\n📅 최근 60일 활동 ${recent.length}건 (일자별)`);
    [...byDay.entries()].sort().forEach(([k, v]) => console.log(`   ${k}  ${v}건`));

    console.log('\n   [액션별]');
    [...byAction.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
      .forEach(([k, v]) => console.log(`   ${k.padEnd(35)} ${v}건`));

    console.log('\n   [접속 IP]');
    [...ips.entries()].sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`   ${k.padEnd(42)} ${v}건`));

    console.log('\n   [User-Agent]');
    [...agents.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .forEach(([k, v]) => console.log(`   ${v}건  ${k.slice(0, 110)}`));

    // 최근 활동 상세 30건
    const detail = await prisma.auditLog.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    console.log('\n🕰 최근 활동 상세 30건');
    detail.forEach((l) =>
      console.log(
        `   ${kst(l.createdAt)} | ${l.action}/${l.entity} | ${l.entityId ?? '-'} | ip=${l.ipAddress ?? '-'}`
      )
    );

    // 통화기록 / 고객
    const calls = await prisma.callLog.count({ where: { userId: u.id } });
    const lastCall = await prisma.callLog.findFirst({
      where: { userId: u.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const owned = await prisma.customer.count({ where: { assignedUserId: u.id, isDeleted: false } });
    console.log(`\n📞 통화기록 총 ${calls}건 | 최근: ${lastCall ? kst(lastCall.createdAt) + ' KST' : '없음'}`);
    console.log(`📊 현재 담당 고객: ${owned}건`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
