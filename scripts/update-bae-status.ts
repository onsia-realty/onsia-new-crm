import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.visitSchedule.update({
    where: { id: 'cmitwvr68000ljm04gu9w7jt7' },
    data: {
      status: 'CHECKED',
      completedAt: new Date()
    }
  });
  console.log('업데이트 완료:', result.status);
}

main().finally(() => prisma.$disconnect());
