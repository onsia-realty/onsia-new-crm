/**
 * 최근 1시간 이내 등록된 잠실 리버리치 배정 고객 조회 (dry-run, 변경 없음)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const USER_EMAIL = 'realtors77@gmail.com';
const SITE_NAME = '잠실 리버리치';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, username: true, name: true, email: true, role: true },
  });

  if (!user) {
    console.error(`❌ 사용자를 찾을 수 없습니다: ${USER_EMAIL}`);
    return;
  }

  console.log(`👤 사용자: ${user.name} (${user.username} / ${user.email}) - ${user.role}`);
  console.log(`🏢 현장: ${SITE_NAME}`);
  console.log();

  // 최근 2시간 이내에 이 사용자에게 배정된 잠실 리버리치 고객 (공개DB 아닌 것)
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2시간 전

  const customers = await prisma.customer.findMany({
    where: {
      assignedUserId: user.id,
      assignedSite: SITE_NAME,
      isPublic: false,
      isDeleted: false,
      createdAt: { gte: since },
    },
    select: {
      id: true,
      phone: true,
      name: true,
      createdAt: true,
      assignedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 최근 2시간 이내 등록 + ${SITE_NAME} 배정 + 본인 DB인 고객: ${customers.length}명`);
  console.log();

  if (customers.length === 0) {
    console.log('대상 고객이 없습니다. 시간 범위를 넓히거나 조건을 확인해주세요.');

    // 참고로 최근 등록된 잠실 리버리치 고객 전체(시간무관) 5건 보여주기
    const recent = await prisma.customer.findMany({
      where: {
        assignedUserId: user.id,
        assignedSite: SITE_NAME,
        isDeleted: false,
      },
      select: { id: true, phone: true, name: true, createdAt: true, isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    if (recent.length > 0) {
      console.log('[참고] 본인 배정 잠실 리버리치 최근 5건:');
      recent.forEach((c) => {
        console.log(
          `  - ${c.createdAt.toISOString()} | ${c.phone} | ${c.name || '(이름없음)'} | isPublic=${c.isPublic}`
        );
      });
    }
    return;
  }

  // 샘플 5건 표시
  console.log('[샘플 5건]');
  customers.slice(0, 5).forEach((c) => {
    console.log(
      `  - ${c.createdAt.toISOString()} | ${c.phone} | ${c.name || '(이름없음)'}`
    );
  });

  if (customers.length > 5) {
    console.log(`  ... 그 외 ${customers.length - 5}건`);
  }

  console.log();
  console.log('다음 단계: 이 고객들을 공개DB로 전환하려면 move-to-public 스크립트 실행');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
