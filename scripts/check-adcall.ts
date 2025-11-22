import { prisma } from '../lib/prisma';

async function main() {
  const phone = '01082574986';

  // Test01 사용자 찾기
  const user = await prisma.user.findFirst({
    where: { username: 'test01' }
  });

  if (!user) {
    console.log('Test01 사용자를 찾을 수 없습니다.');
    return;
  }

  console.log('Test01 정보:');
  console.log('- ID:', user.id);
  console.log('- 이름:', user.name);
  console.log('- 사용자명:', user.username);

  // 광고콜 찾기
  const adCall = await prisma.adCallNumber.findFirst({
    where: { phoneNumber: phone },
    include: {
      assignedTo: {
        select: { id: true, name: true, username: true }
      }
    }
  });

  if (!adCall) {
    console.log('\n광고콜을 찾을 수 없습니다.');
    return;
  }

  console.log('\n광고콜 정보:');
  console.log('- ID:', adCall.id);
  console.log('- 전화번호:', adCall.phoneNumber);
  console.log('- 상태:', adCall.status);
  console.log('- 배정된 사용자:', adCall.assignedTo?.name || '없음');
  console.log('- 생성일:', adCall.createdAt);

  // 이 번호로 생성된 고객 찾기
  const customer = await prisma.customer.findFirst({
    where: { phone: phone.replace(/-/g, '') },
    include: {
      assignedUser: {
        select: { name: true, username: true }
      }
    }
  });

  if (customer) {
    console.log('\n관련 고객 정보:');
    console.log('- 고객 ID:', customer.id);
    console.log('- 이름:', customer.name);
    console.log('- 전화번호:', customer.phone);
    console.log('- 담당자:', customer.assignedUser?.name || '없음');
  } else {
    console.log('\n아직 고객으로 전환되지 않았습니다.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
