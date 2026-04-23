import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 관리자 및 최근 로그인한 사용자 목록
  const admins = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'ADMIN' },
        { role: 'CEO' },
      ],
    },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      lastLoginAt: true,
    },
    orderBy: { lastLoginAt: 'desc' },
  });

  console.log(`관리자/CEO 계정 ${admins.length}명:`);
  admins.forEach((u) => {
    console.log(
      `  - ${u.role} | ${u.username} | ${u.name} | email=${u.email || '(없음)'} | phone=${u.phone} | lastLogin=${u.lastLoginAt?.toISOString() || '(없음)'}`
    );
  });

  console.log();

  // 최근 2시간 이내에 생성된 모든 잠실 리버리치 고객 (누가 등록했는지 확인)
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recentCustomers = await prisma.customer.findMany({
    where: {
      assignedSite: '잠실 리버리치',
      createdAt: { gte: since },
      isDeleted: false,
    },
    select: {
      id: true,
      phone: true,
      name: true,
      assignedUserId: true,
      isPublic: true,
      createdAt: true,
      assignedUser: { select: { name: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`최근 2시간 이내 등록된 잠실 리버리치 고객 (최대 10건):`);
  recentCustomers.forEach((c) => {
    console.log(
      `  - ${c.createdAt.toISOString()} | ${c.phone} | 담당=${c.assignedUser?.name || '(미배정)'} | isPublic=${c.isPublic}`
    );
  });

  console.log();

  // 전체 카운트
  const totalRecent = await prisma.customer.count({
    where: {
      assignedSite: '잠실 리버리치',
      createdAt: { gte: since },
      isDeleted: false,
    },
  });
  console.log(`총 ${totalRecent}건`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
