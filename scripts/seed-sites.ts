import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_SITES = [
  { name: '용인경남아너스빌', color: 'blue', icon: '🏢', sortOrder: 10 },
  { name: '신광교클라우드시티', color: 'green', icon: '🏙️', sortOrder: 20 },
  { name: '평택 로제비앙', color: 'purple', icon: '🏘️', sortOrder: 30 },
  { name: '왕십리 어반홈스', color: 'orange', icon: '🏗️', sortOrder: 40 },
  { name: '잠실 리버리치', color: 'cyan', icon: '🌊', sortOrder: 50 },
  { name: '야목역 서희스타힐스', color: 'red', icon: '🚉', sortOrder: 60 },
];

async function main() {
  for (const site of DEFAULT_SITES) {
    const result = await prisma.site.upsert({
      where: { name: site.name },
      update: {
        // 기존 레코드가 있으면 이름만 기준으로 잡고 색/아이콘/순서는 덮어쓰지 않음 (관리자가 수정했을 수 있음)
      },
      create: {
        name: site.name,
        color: site.color,
        icon: site.icon,
        sortOrder: site.sortOrder,
        isActive: true,
      },
    });
    console.log(`✅ ${result.name} (${result.id})`);
  }
  console.log(`\n총 ${DEFAULT_SITES.length}개 기본 현장 시드 완료`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
