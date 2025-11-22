import { prisma } from '../lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: 'test', mode: 'insensitive' } },
        { name: { contains: 'test', mode: 'insensitive' } },
        { name: { contains: 'Test' } },
        { username: { contains: 'Test' } }
      ]
    },
    select: {
      id: true,
      username: true,
      name: true,
      isActive: true
    }
  });

  console.log('Test 관련 사용자:', users.length, '명');
  for (const u of users) {
    const status = u.isActive ? '활성' : '비활성';
    console.log(`- ${u.name} (${u.username}) [${status}]`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
