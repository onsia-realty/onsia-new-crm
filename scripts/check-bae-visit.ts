import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const visits = await prisma.visitSchedule.findMany({
    where: {
      customer: {
        name: { contains: '배은경' }
      }
    },
    include: {
      customer: { select: { name: true, phone: true } },
      user: { select: { name: true } }
    }
  });

  console.log('배은경 방문일정:');
  visits.forEach(v => {
    console.log('- ID:', v.id);
    console.log('  상태:', v.status);
    console.log('  날짜:', v.visitDate);
    console.log('  담당:', v.user.name);
    console.log('');
  });
}

main().finally(() => prisma.$disconnect());
