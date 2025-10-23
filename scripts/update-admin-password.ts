import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  try {
    const newPassword = '#duseorua12';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const admin = await prisma.user.update({
      where: { username: 'admin' },
      data: {
        password: hashedPassword,
      },
    });

    console.log('✅ Admin 비밀번호 변경 완료:');
    console.log('아이디:', admin.username);
    console.log('새 비밀번호:', newPassword);
    console.log('이메일:', admin.email);
  } catch (error: any) {
    if (error.code === 'P2025') {
      console.error('❌ admin 계정을 찾을 수 없습니다.');
    } else {
      console.error('❌ 비밀번호 변경 실패:', error);
    }
  }
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
