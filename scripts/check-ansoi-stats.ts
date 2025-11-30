import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAnsoiData() {
  try {
    const ansoi = await prisma.user.findFirst({ where: { name: '안소이' } });
    if (!ansoi) {
      console.log('안소이 사용자를 찾을 수 없습니다.');
      return;
    }

    const totalCustomers = await prisma.customer.count({
      where: { assignedUserId: ansoi.id, isDeleted: false }
    });

    const duplicateCustomers = await prisma.customer.count({
      where: { assignedUserId: ansoi.id, isDeleted: false, isDuplicate: true }
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCustomers = await prisma.customer.count({
      where: {
        assignedUserId: ansoi.id,
        isDeleted: false,
        createdAt: { gte: todayStart }
      }
    });

    console.log('=== 안소이 고객 데이터 현황 ===');
    console.log(`총 고객 수: ${totalCustomers}건`);
    console.log(`중복 표시된 고객: ${duplicateCustomers}건`);
    console.log(`금일 등록 고객: ${todayCustomers}건`);

  } catch (error) {
    console.error('오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAnsoiData();
