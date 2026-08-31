import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const kst = (d: Date | null) =>
  d ? new Date(d.getTime() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19) : '-';

const SINCE = new Date('2026-07-31T15:00:00Z'); // KST 8/1 00:00

async function main() {
  const u = await prisma.user.findFirst({ where: { username: 'yunsang1238' } });
  if (!u) return console.log('not found');
  console.log(`대상: ${u.name} (${u.username}) id=${u.id}\n8월 이후 모든 흔적 조사\n${'='.repeat(60)}`);

  const rows: { src: string; at: Date; info: string }[] = [];

  const push = (src: string, at: Date | null, info: string) => {
    if (at && at >= SINCE) rows.push({ src, at, info });
  };

  // 1. 감사로그
  (await prisma.auditLog.findMany({ where: { userId: u.id, createdAt: { gte: SINCE } } })).forEach(
    (x) => push('AuditLog', x.createdAt, `${x.action}/${x.entity} ip=${x.ipAddress ?? '-'}`)
  );

  // 2. 통화기록
  (await prisma.callLog.findMany({ where: { userId: u.id, createdAt: { gte: SINCE } } })).forEach((x) =>
    push('CallLog', x.createdAt, x.content.slice(0, 40))
  );

  // 3. 출퇴근 보고
  (await prisma.dailyReport.findMany({ where: { userId: u.id } })).forEach((x) => {
    push('DailyReport(생성)', x.createdAt, JSON.stringify(x).slice(0, 150));
    push('DailyReport(수정)', x.updatedAt, '수정');
  });

  // 4. 방문일정
  (await prisma.visitSchedule.findMany({ where: { userId: u.id } })).forEach((x) => {
    push('VisitSchedule(생성)', x.createdAt, '방문일정 생성');
    push('VisitSchedule(수정)', x.updatedAt, '방문일정 수정');
  });

  // 5. 담당고객 수정
  (
    await prisma.customer.findMany({
      where: { assignedUserId: u.id, updatedAt: { gte: SINCE } },
      select: { name: true, phone: true, updatedAt: true },
    })
  ).forEach((x) => push('Customer(수정)', x.updatedAt, `${x.name ?? ''} ${x.phone}`));

  // 6. 관심카드
  (await prisma.interestCard.findMany({ where: { createdAt: { gte: SINCE } } })).forEach((x) => {
    const j = JSON.stringify(x);
    if (j.includes(u.id)) push('InterestCard', x.createdAt, '관심카드');
  });

  // 7. 일일 할일
  (await prisma.dailyTodo.findMany({ where: { userId: u.id } })).forEach((x) => {
    push('DailyTodo(생성)', x.createdAt, '할일');
    push('DailyTodo(수정)', x.updatedAt, '할일 수정');
  });

  // 8. 토론 메시지
  (await prisma.discussionMessage.findMany({ where: { userId: u.id } })).forEach((x) =>
    push('DiscussionMessage', x.createdAt, x.content?.slice(0, 40) ?? '')
  );
  (await prisma.discussion.findMany({ where: { createdById: u.id } })).forEach((x) =>
    push('Discussion', x.createdAt, x.title ?? '')
  );

  // 9. 푸시 구독 (앱 사용 흔적)
  (await prisma.pushSubscription.findMany({ where: { userId: u.id } })).forEach((x) => {
    console.log(
      `\n📱 푸시구독: 생성=${kst(x.createdAt)} 마지막발송성공=${kst(x.lastSeenAt)} ua=${(x as any).userAgent?.slice(0, 60) ?? '-'}`
    );
  });

  // 10. 광고콜 배정/수상
  (await prisma.adCallNumber.findMany({ where: { assignedUserId: u.id } })).forEach((x) => {
    push('AdCall(배정)', (x as any).assignedAt, '광고콜 배정');
    push('AdCall(수정)', (x as any).updatedAt, '광고콜 수정');
  });
  (await prisma.adCallAward.findMany({ where: { userId: u.id } })).forEach((x) =>
    push('AdCallAward', x.createdAt, '시상')
  );
  (await prisma.adCallAwardComment.findMany({ where: { authorId: u.id } })).forEach((x) =>
    push('AwardComment', x.createdAt, x.content?.slice(0, 40) ?? '')
  );

  // 11. 계약활동
  (
    await prisma.contractActivity.findMany({
      where: { OR: [{ employeeId: u.id }, { createdById: u.id }] },
    })
  ).forEach((x) => push('ContractActivity', x.createdAt, `${x.siteName ?? ''} ${x.customerName ?? ''}`));

  // 12. 블랙리스트
  (await prisma.blacklist.findMany({ where: { registeredById: u.id } })).forEach((x) =>
    push('Blacklist', x.createdAt, x.phone)
  );

  // 13. 이관요청
  (await prisma.transferRequest.findMany({ where: { fromUserId: u.id } })).forEach((x) =>
    push('TransferRequest(from)', x.createdAt, '이관요청')
  );
  (await prisma.transferRequest.findMany({ where: { toUserId: u.id } })).forEach((x) =>
    push('TransferRequest(to)', x.createdAt, '이관수신')
  );

  rows.sort((a, b) => a.at.getTime() - b.at.getTime());
  console.log(`\n🔎 8/1 이후 흔적 총 ${rows.length}건\n`);
  rows.forEach((r) => console.log(`  ${kst(r.at)} | ${r.src.padEnd(22)} | ${r.info}`));

  if (rows.length) {
    console.log(`\n▶ 가장 마지막 흔적: ${kst(rows[rows.length - 1].at)} (${rows[rows.length - 1].src})`);
  }

  // 참고: 다른 직원들의 최근 활동 (시스템 전체가 조용한 건 아닌지 확인)
  console.log(`\n${'='.repeat(60)}\n📊 대조군 — 전 직원 8/13 이후 감사로그 건수:`);
  const others = await prisma.auditLog.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: new Date('2026-08-12T15:00:00Z') } },
    _count: true,
    _max: { createdAt: true },
  });
  const names = await prisma.user.findMany({ select: { id: true, name: true, role: true } });
  const nm = new Map(names.map((n) => [n.id, `${n.name}(${n.role})`]));
  others
    .sort((a, b) => b._count - a._count)
    .forEach((o) =>
      console.log(`   ${(nm.get(o.userId!) ?? o.userId).padEnd(28)} ${String(o._count).padStart(5)}건  최종=${kst(o._max.createdAt)}`)
    );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
