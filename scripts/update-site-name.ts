import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateSiteName() {
  console.log('🔄 "배분 고객"을 "관리자 배분"으로 업데이트 중...');

  const result = await prisma.customer.updateMany({
    where: {
      assignedSite: '배분 고객',
    },
    data: {
      assignedSite: '관리자 배분',
    },
  });

  console.log(`✅ ${result.count}개의 고객 데이터가 업데이트되었습니다.`);
}

updateSiteName()
  .catch((e) => {
    console.error('❌ 업데이트 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
