import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 추재현, 박찬효 담당 고객 중 중복 전화번호 확인
  const customers = await prisma.customer.findMany({
    where: {
      assignedUser: {
        name: { in: ['추재현', '박찬효'] }
      }
    },
    select: {
      id: true,
      name: true,
      phone: true,
      isDeleted: true,
      assignedUser: { select: { name: true } }
    },
    orderBy: { phone: 'asc' }
  });

  // 전화번호별로 그룹화하여 중복 찾기
  const phoneMap = new Map<string, typeof customers>();
  customers.forEach(c => {
    if (!phoneMap.has(c.phone)) phoneMap.set(c.phone, []);
    phoneMap.get(c.phone)!.push(c);
  });

  console.log('=== 추재현/박찬효 중복 전화번호 ===\n');
  let found = false;
  phoneMap.forEach((custs, phone) => {
    if (custs.length > 1) {
      found = true;
      console.log(`[${phone}]`);
      custs.forEach(c => {
        const deleted = c.isDeleted ? '[삭제됨]' : '';
        console.log(`  - ${c.name || '이름없음'} | 담당: ${c.assignedUser?.name} ${deleted}`);
      });
      console.log('');
    }
  });

  if (!found) {
    console.log('중복 없음');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
