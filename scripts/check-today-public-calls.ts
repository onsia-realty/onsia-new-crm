import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const count = await prisma.customer.count({
    where: {
      isDeleted: false,
      callLogs: {
        some: { createdAt: { gte: today, lt: tomorrow } },
      },
      OR: [
        { isPublic: true },
        {
          allocations: {
            some: { reason: { startsWith: '공개DB에서 클레임' } },
          },
        },
      ],
    },
  });
  console.log(`오늘 (${today.toISOString().slice(0, 10)}) 통화된 공개DB 출신 고객: ${count}명`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
