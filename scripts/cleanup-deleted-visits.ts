import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 삭제된 고객의 방문 일정 확인
  const deletedCustomerVisits = await prisma.visitSchedule.findMany({
    where: {
      customer: {
        isDeleted: true
      }
    },
    include: {
      customer: {
        select: { name: true, phone: true }
      },
      user: {
        select: { name: true }
      }
    }
  });

  console.log(`삭제된 고객의 방문 일정: ${deletedCustomerVisits.length}건`);
  for (const v of deletedCustomerVisits) {
    console.log(`  - ${v.customer.name} (담당: ${v.user.name}) - ID: ${v.id}`);
  }

  // 삭제 실행
  const result = await prisma.visitSchedule.deleteMany({
    where: {
      customer: {
        isDeleted: true
      }
    }
  });

  console.log(`\n✅ ${result.count}건의 방문 일정 삭제 완료`);

  // 확인
  const remaining = await prisma.visitSchedule.count({
    where: {
      customer: {
        isDeleted: true
      }
    }
  });
  console.log(`남은 삭제 고객 방문 일정: ${remaining}건`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
