import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const claims = await prisma.customerAllocation.findMany({
    where: {
      reason: { startsWith: '공개DB에서 클레임' },
      toUserId: { not: null },
    },
    select: {
      customerId: true,
      toUserId: true,
      toUser: { select: { name: true, username: true } },
    },
  });

  const byUser = new Map<string, { name: string; username: string; customers: Set<string> }>();
  claims.forEach((c) => {
    if (!c.toUserId || !c.toUser) return;
    if (!byUser.has(c.toUserId)) {
      byUser.set(c.toUserId, {
        name: c.toUser.name,
        username: c.toUser.username,
        customers: new Set(),
      });
    }
    byUser.get(c.toUserId)!.customers.add(c.customerId);
  });

  const sorted = Array.from(byUser.entries()).sort(
    (a, b) => b[1].customers.size - a[1].customers.size
  );
  console.log('직원별 공개DB 클레임 수 (DISTINCT 고객 기준):');
  sorted.forEach(([, info]) => {
    console.log(`  ${info.name.padEnd(8)} (${info.username}): ${info.customers.size}명`);
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
