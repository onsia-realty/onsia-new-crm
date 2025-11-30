import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAnsoiDuplicates() {
  try {
    // 안소이 사용자 찾기
    const ansoi = await prisma.user.findFirst({
      where: { name: '안소이' }
    });

    if (!ansoi) {
      console.log('안소이 사용자를 찾을 수 없습니다.');
      return;
    }

    console.log(`안소이 ID: ${ansoi.id}`);

    // 오늘 날짜 범위
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 안소이가 금일 등록한 고객 중 isDuplicate=true인 것 찾기
    const duplicateCustomers = await prisma.customer.findMany({
      where: {
        assignedUserId: ansoi.id,
        createdAt: {
          gte: today,
          lt: tomorrow
        },
        isDuplicate: true
      },
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true
      }
    });

    console.log(`\n삭제 대상: ${duplicateCustomers.length}건`);

    if (duplicateCustomers.length === 0) {
      console.log('삭제할 중복 고객이 없습니다.');
      return;
    }

    // 샘플 출력
    console.log('\n삭제될 데이터 샘플 (처음 5건):');
    duplicateCustomers.slice(0, 5).forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name || '이름없음'} - ${c.phone}`);
    });

    // 관련 데이터 먼저 삭제 (외래키 제약)
    const customerIds = duplicateCustomers.map(c => c.id);

    // 1. 방문 일정 삭제
    const deletedVisits = await prisma.visitSchedule.deleteMany({
      where: { customerId: { in: customerIds } }
    });
    console.log(`\n삭제된 방문 일정: ${deletedVisits.count}건`);

    // 2. 통화 기록 삭제
    const deletedCallLogs = await prisma.callLog.deleteMany({
      where: { customerId: { in: customerIds } }
    });
    console.log(`삭제된 통화 기록: ${deletedCallLogs.count}건`);

    // 3. 관심 카드 삭제
    const deletedInterestCards = await prisma.interestCard.deleteMany({
      where: { customerId: { in: customerIds } }
    });
    console.log(`삭제된 관심 카드: ${deletedInterestCards.count}건`);

    // 4. 고객 배분 기록 삭제
    const deletedAllocations = await prisma.customerAllocation.deleteMany({
      where: { customerId: { in: customerIds } }
    });
    console.log(`삭제된 배분 기록: ${deletedAllocations.count}건`);

    // 5. 이관 요청 삭제
    const deletedTransfers = await prisma.transferRequest.deleteMany({
      where: { customerId: { in: customerIds } }
    });
    console.log(`삭제된 이관 요청: ${deletedTransfers.count}건`);

    // 6. 경품 당첨자 삭제
    const deletedPrizeWinners = await prisma.prizeWinner.deleteMany({
      where: { customerId: { in: customerIds } }
    });
    console.log(`삭제된 경품 당첨: ${deletedPrizeWinners.count}건`);

    // 7. 고객 삭제
    const deletedCustomers = await prisma.customer.deleteMany({
      where: { id: { in: customerIds } }
    });
    console.log(`삭제된 고객: ${deletedCustomers.count}건`);

    console.log('\n✅ 삭제 완료!');

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAnsoiDuplicates();
