import { prisma } from '../lib/prisma';

async function main() {
  // 안소이 직원 찾기
  const ansoiUser = await prisma.user.findFirst({
    where: {
      name: { contains: '안소이', mode: 'insensitive' },
    },
    select: {
      id: true,
      username: true,
      name: true,
    }
  });

  if (!ansoiUser) {
    console.log('안소이 직원을 찾을 수 없습니다.');
    return;
  }

  console.log(`=== 안소이 직원 정보 ===`);
  console.log(`이름: ${ansoiUser.name}, ID: ${ansoiUser.id}`);

  // 오늘 날짜 기준
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log(`\n=== 오늘 (${today.toLocaleDateString('ko-KR')}) 등록된 중복 고객 ===`);

  // 오늘 등록된 중복 고객 조회
  const todayDuplicates = await prisma.customer.findMany({
    where: {
      assignedUserId: ansoiUser.id,
      isDuplicate: true,
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      createdAt: true,
      assignedSite: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`총 ${todayDuplicates.length}건\n`);

  // 현장별 그룹화
  const siteGroups = new Map<string, typeof todayDuplicates>();
  for (const c of todayDuplicates) {
    const site = c.assignedSite || '현장미지정';
    if (!siteGroups.has(site)) {
      siteGroups.set(site, []);
    }
    siteGroups.get(site)!.push(c);
  }

  for (const [site, customers] of siteGroups) {
    console.log(`\n[${site}] - ${customers.length}건`);
    console.log('-'.repeat(60));
    for (const c of customers.slice(0, 20)) { // 처음 20개만 표시
      const time = c.createdAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      console.log(`  ${c.name || '(이름없음)'} | ${c.phone} | ${time}`);
    }
    if (customers.length > 20) {
      console.log(`  ... 외 ${customers.length - 20}건`);
    }
  }

  // 이 중복 고객들의 원본 (다른 담당자에게 이미 배정된 고객) 조회
  const duplicatePhones = todayDuplicates.map(c => c.phone);

  if (duplicatePhones.length > 0) {
    const originalCustomers = await prisma.customer.findMany({
      where: {
        phone: { in: duplicatePhones },
        assignedUserId: { not: ansoiUser.id },
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true,
        assignedSite: true,
        assignedUser: {
          select: { name: true }
        }
      },
      orderBy: { phone: 'asc' }
    });

    console.log(`\n\n=== 위 중복 고객들의 원래 담당자 (다른 직원) ===`);
    console.log(`총 ${originalCustomers.length}건\n`);

    // 담당자별 그룹화
    const ownerGroups = new Map<string, typeof originalCustomers>();
    for (const c of originalCustomers) {
      const owner = c.assignedUser?.name || '담당자없음';
      if (!ownerGroups.has(owner)) {
        ownerGroups.set(owner, []);
      }
      ownerGroups.get(owner)!.push(c);
    }

    for (const [owner, customers] of ownerGroups) {
      console.log(`\n[${owner}] - ${customers.length}건`);
      console.log('-'.repeat(60));
      for (const c of customers.slice(0, 10)) {
        console.log(`  ${c.name || '(이름없음)'} | ${c.phone} | ${c.assignedSite || '현장미지정'}`);
      }
      if (customers.length > 10) {
        console.log(`  ... 외 ${customers.length - 10}건`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
