import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 신미석 고객 전체 확인
  const sinmiseokCustomers = await prisma.customer.findMany({
    where: {
      name: {
        contains: '신미석'
      }
    },
    include: {
      assignedUser: {
        select: {
          name: true
        }
      },
      visitSchedules: {
        select: {
          id: true,
          visitDate: true,
          status: true
        }
      }
    }
  });

  console.log('=== 신미석 고객 전체 목록 ===');
  for (const c of sinmiseokCustomers) {
    console.log(`\n[${c.isDeleted ? '❌ 삭제됨' : '✅ 활성'}]`);
    console.log(`  ID: ${c.id}`);
    console.log(`  이름: ${c.name}`);
    console.log(`  전화번호: ${c.phone}`);
    console.log(`  담당자: ${c.assignedUser?.name || '미배분'}`);
    console.log(`  삭제여부: ${c.isDeleted}`);
    console.log(`  방문일정: ${c.visitSchedules.length}건`);
    for (const v of c.visitSchedules) {
      console.log(`    - ${v.visitDate.toISOString().split('T')[0]} (${v.status})`);
    }
  }

  // 배은경 고객도 확인
  console.log('\n\n=== 배은경 고객 확인 ===');
  const baeCustomers = await prisma.customer.findMany({
    where: {
      name: {
        contains: '배은경'
      }
    },
    include: {
      assignedUser: {
        select: {
          name: true
        }
      },
      visitSchedules: {
        select: {
          id: true,
          visitDate: true,
          status: true
        }
      }
    }
  });

  for (const c of baeCustomers) {
    console.log(`\n[${c.isDeleted ? '❌ 삭제됨' : '✅ 활성'}]`);
    console.log(`  ID: ${c.id}`);
    console.log(`  이름: ${c.name}`);
    console.log(`  전화번호: ${c.phone}`);
    console.log(`  담당자: ${c.assignedUser?.name || '미배분'}`);
    console.log(`  삭제여부: ${c.isDeleted}`);
    console.log(`  방문일정: ${c.visitSchedules.length}건`);
  }

  // 김수경 담당 고객 중 삭제된 것 확인
  console.log('\n\n=== 김수경 담당자 확인 ===');
  const kimsookyung = await prisma.user.findFirst({
    where: { name: '김수경' }
  });

  if (kimsookyung) {
    const deletedByKim = await prisma.customer.findMany({
      where: {
        assignedUserId: kimsookyung.id,
        isDeleted: true
      },
      select: {
        id: true,
        name: true,
        phone: true,
        isDeleted: true
      }
    });
    console.log(`김수경 담당 중 삭제된 고객: ${deletedByKim.length}건`);
    for (const c of deletedByKim) {
      console.log(`  - ${c.name} (${c.phone})`);
    }
  }

  // 오늘 방문 일정 확인 (삭제되지 않은 고객만)
  console.log('\n\n=== 오늘 방문 일정 (활성 고객만) ===');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayVisitsActive = await prisma.visitSchedule.findMany({
    where: {
      visitDate: { gte: today, lt: tomorrow },
      customer: {
        isDeleted: false
      }
    },
    include: {
      customer: {
        select: { name: true, phone: true, isDeleted: true }
      },
      user: {
        select: { name: true }
      }
    }
  });

  console.log(`활성 고객 방문 일정: ${todayVisitsActive.length}건`);
  for (const v of todayVisitsActive) {
    console.log(`  - ${v.customer.name} (담당: ${v.user.name})`);
  }

  // 삭제된 고객 포함 전체
  const todayVisitsAll = await prisma.visitSchedule.findMany({
    where: {
      visitDate: { gte: today, lt: tomorrow }
    },
    include: {
      customer: {
        select: { name: true, phone: true, isDeleted: true }
      },
      user: {
        select: { name: true }
      }
    }
  });

  console.log(`\n전체 방문 일정 (삭제 포함): ${todayVisitsAll.length}건`);
  for (const v of todayVisitsAll) {
    const status = v.customer.isDeleted ? '❌삭제' : '✅활성';
    console.log(`  - [${status}] ${v.customer.name} (담당: ${v.user.name})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
