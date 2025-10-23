import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // realtors7 계정을 CEO로 업데이트
    const user = await prisma.user.update({
      where: { username: 'realtors7' },
      data: {
        role: 'CEO',
        department: '대표이사실',
        position: '대표이사',
        approvedAt: new Date(),
        isActive: true,
      },
    });

    console.log('✅ CEO 계정 업데이트 완료:');
    console.log('아이디:', user.username);
    console.log('이름:', user.name);
    console.log('이메일:', user.email);
    console.log('역할:', user.role);
    console.log('부서:', user.department);
    console.log('직급:', user.position);
  } catch (error: any) {
    if (error.code === 'P2025') {
      console.error('❌ realtors7 계정을 찾을 수 없습니다.');
      console.log('회원가입을 먼저 진행해주세요.');
    } else {
      console.error('❌ 업데이트 실패:', error);
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
