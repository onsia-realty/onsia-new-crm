import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const title = process.argv[2];
  const content = process.argv[3];

  if (!title || !content) {
    console.error('Usage: npx tsx prisma/add-announcement.ts "title" "content"');
    process.exit(1);
  }

  // 관리자 찾기
  const admin = await prisma.user.findFirst({
    where: {
      role: { in: ['ADMIN', 'CEO', 'HEAD'] }
    }
  });

  if (!admin) {
    console.error('관리자를 찾을 수 없습니다.');
    process.exit(1);
  }

  const notice = await prisma.notice.create({
    data: {
      title,
      content,
      authorId: admin.id,
      isPinned: true,
      category: 'GENERAL',
    }
  });

  console.log('공지사항이 추가되었습니다:', notice.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
