import { PrismaClient } from '@prisma/client';
import { LEADERBOARD_WEIGHTS, calculateTotalScore } from '../lib/leaderboard/weights';
import { getPeriodRange } from '../lib/leaderboard/period';

const prisma = new PrismaClient();

async function main() {
  const { from, to } = getPeriodRange('week');
  console.log(`\n기간: ${from.toISOString()} ~ ${to.toISOString()}`);

  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE', isActive: true },
    select: { id: true, name: true, department: true },
  });
  const userIds = employees.map((u) => u.id);
  console.log(`EMPLOYEE 활성 직원: ${employees.length}명`);

  const [callCounts, absenceCounts, claims, newCust, contracts] = await Promise.all([
    prisma.callLog.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, createdAt: { gte: from, lt: to } },
      _count: { _all: true },
    }),
    prisma.callLog.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        content: { contains: '부재' },
        createdAt: { gte: from, lt: to },
      },
      _count: { _all: true },
    }),
    prisma.customerAllocation.findMany({
      where: {
        toUserId: { in: userIds },
        reason: { startsWith: '공개DB에서 클레임' },
        createdAt: { gte: from, lt: to },
      },
      select: { toUserId: true, customerId: true },
    }),
    prisma.customer.groupBy({
      by: ['assignedUserId'],
      where: {
        assignedUserId: { in: userIds },
        isDeleted: false,
        createdAt: { gte: from, lt: to },
      },
      _count: { _all: true },
    }),
    prisma.interestCard.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: from, lt: to },
        customer: { assignedUserId: { in: userIds } },
      },
      select: { customer: { select: { assignedUserId: true } } },
    }),
  ]);

  const callMap = new Map<string, number>();
  callCounts.forEach((c) => c.userId && callMap.set(c.userId, c._count._all));
  const absenceMap = new Map<string, number>();
  absenceCounts.forEach((c) => c.userId && absenceMap.set(c.userId, c._count._all));
  const claimMap = new Map<string, Set<string>>();
  claims.forEach((c) => {
    if (!c.toUserId) return;
    if (!claimMap.has(c.toUserId)) claimMap.set(c.toUserId, new Set());
    claimMap.get(c.toUserId)!.add(c.customerId);
  });
  const newCustMap = new Map<string, number>();
  newCust.forEach((c) => c.assignedUserId && newCustMap.set(c.assignedUserId, c._count._all));
  const contractMap = new Map<string, number>();
  contracts.forEach((r) => {
    const uid = r.customer?.assignedUserId;
    if (!uid) return;
    contractMap.set(uid, (contractMap.get(uid) || 0) + 1);
  });

  const rows = employees.map((emp) => {
    const callCount = callMap.get(emp.id) || 0;
    const absenceCallCount = absenceMap.get(emp.id) || 0;
    const publicClaimCount = claimMap.get(emp.id)?.size || 0;
    const newCustomerCount = newCustMap.get(emp.id) || 0;
    const contractCount = contractMap.get(emp.id) || 0;
    return {
      name: emp.name,
      callCount,
      absenceCallCount,
      publicClaimCount,
      newCustomerCount,
      contractCount,
      totalScore: calculateTotalScore({
        callCount,
        absenceCallCount,
        publicClaimCount,
        newCustomerCount,
        contractCount,
      }),
    };
  }).sort((a, b) => b.totalScore - a.totalScore);

  console.log(`\n가중치: ${JSON.stringify(LEADERBOARD_WEIGHTS)}`);
  console.log(`\n=== 이번 주 리더보드 ===`);
  console.log(
    '순위 이름           통화  부재  클레임  신규  계약  종합'
  );
  rows.forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(2)}위 ${r.name.padEnd(12)} ${String(r.callCount).padStart(4)} ${String(
        r.absenceCallCount
      ).padStart(4)} ${String(r.publicClaimCount).padStart(6)} ${String(
        r.newCustomerCount
      ).padStart(4)} ${String(r.contractCount).padStart(4)} ${r.totalScore.toString().padStart(6)}`
    );
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
