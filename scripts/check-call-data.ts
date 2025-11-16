import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCallData() {
  try {
    // 전체 고객 수
    const totalCustomers = await prisma.customer.count({
      where: { isDeleted: false }
    });
    console.log('\n📊 전체 고객 수:', totalCustomers);

    // 통화 기록이 있는 고객 수
    const customersWithCalls = await prisma.customer.count({
      where: {
        isDeleted: false,
        callLogs: {
          some: {}
        }
      }
    });
    console.log('📞 통화 기록이 있는 고객:', customersWithCalls);

    // 메모가 있는 고객 수
    const customersWithMemo = await prisma.customer.count({
      where: {
        isDeleted: false,
        memo: {
          not: null,
          not: ''
        }
      }
    });
    console.log('📝 메모가 있는 고객:', customersWithMemo);

    // 샘플 고객 데이터 확인 (처음 5개)
    const sampleCustomers = await prisma.customer.findMany({
      where: { isDeleted: false },
      take: 5,
      include: {
        _count: {
          select: {
            callLogs: true,
            interestCards: true,
            visitSchedules: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('\n📋 샘플 고객 데이터 (최근 5명):');
    sampleCustomers.forEach((customer, index) => {
      console.log(`\n${index + 1}. ${customer.name || '(이름없음)'}`);
      console.log(`   전화: ${customer.phone}`);
      console.log(`   메모: ${customer.memo ? '있음 (' + customer.memo.substring(0, 20) + '...)' : '없음'}`);
      console.log(`   통화기록: ${customer._count.callLogs}건`);
      console.log(`   관심카드: ${customer._count.interestCards}건`);
      console.log(`   방문일정: ${customer._count.visitSchedules}건`);
    });

    // 전체 통화 기록 수
    const totalCallLogs = await prisma.callLog.count();
    console.log('\n📞 전체 통화 기록 수:', totalCallLogs);

    // 통화 기록 샘플
    const sampleCallLogs = await prisma.callLog.findMany({
      take: 5,
      include: {
        customer: {
          select: { name: true, phone: true }
        },
        user: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (sampleCallLogs.length > 0) {
      console.log('\n📞 최근 통화 기록 샘플:');
      sampleCallLogs.forEach((log, index) => {
        console.log(`${index + 1}. ${log.customer?.name} - ${log.user?.name} - ${log.content.substring(0, 30)}...`);
      });
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCallData();
