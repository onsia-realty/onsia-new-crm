import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 사용법: npx tsx scripts/set-user-active.ts <username> <true|false>
const [username, activeArg] = process.argv.slice(2);

const kst = (d: Date) =>
  new Date(d.getTime() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);

async function main() {
  if (!username || (activeArg !== 'true' && activeArg !== 'false')) {
    console.log('사용법: npx tsx scripts/set-user-active.ts <username> <true|false>');
    process.exit(1);
  }
  const isActive = activeArg === 'true';

  const before = await prisma.user.findUnique({
    where: { username },
    select: { id: true, name: true, username: true, role: true, isActive: true, lastLoginAt: true },
  });

  if (!before) {
    console.log(`❌ username="${username}" 사용자를 찾지 못했습니다.`);
    return;
  }

  console.log(`변경 전: ${before.name}(${before.username}) | ${before.role} | isActive=${before.isActive}`);

  const after = await prisma.user.update({
    where: { id: before.id },
    data: { isActive },
    select: { name: true, username: true, isActive: true },
  });

  // 관리자 조치 기록 (로그인 기록 화면에서 함께 확인 가능)
  await prisma.auditLog.create({
    data: {
      userId: before.id,
      action: isActive ? 'REACTIVATE' : 'DEACTIVATE',
      entity: 'User',
      entityId: before.id,
      changes: { isActive: { from: before.isActive, to: isActive }, by: 'admin-script' },
    },
  });

  console.log(`변경 후: ${after.name}(${after.username}) | isActive=${after.isActive}`);
  console.log(`처리 시각: ${kst(new Date())} KST`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
