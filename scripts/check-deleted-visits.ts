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
        select: {
          id: true,
          name: true,
          phone: true,
          isDeleted: true
        }
      },
      user: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      visitDate: 'desc'
    },
    take: 20
  });

  console.log('=== 삭제된 고객의 방문 일정 ===');
  console.log(`총 ${deletedCustomerVisits.length}건`);

  for (const visit of deletedCustomerVisits) {
    const dateStr = visit.visitDate.toISOString().split('T')[0];
    console.log(`- ${visit.customer.name} (${visit.customer.phone}) - ${dateStr} - 담당: ${visit.user.name} - 상태: ${visit.status}`);
  }

  // 신미석 고객 확인
  const sinmiseokCustomers = await prisma.customer.findMany({
    where: {
      name: {
        contains: '신미석'
      }
    },
    include: {
      visitSchedules: true
    }
  });

  console.log('\n=== 신미석 고객 정보 ===');
  for (const c of sinmiseokCustomers) {
    console.log(`- ID: ${c.id}, 이름: ${c.name}, 삭제됨: ${c.isDeleted}, 방문일정: ${c.visitSchedules.length}건`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
