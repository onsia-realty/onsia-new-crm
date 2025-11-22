import { prisma } from '../lib/prisma';

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 박찬효님 찾기
  const user = await prisma.user.findFirst({
    where: { name: '박찬효' }
  });
  
  if (!user) {
    console.log('박찬효님을 찾을 수 없습니다.');
    return;
  }
  
  console.log('박찬효님 ID:', user.id);
  console.log('이름:', user.name);
  
  // 오늘 업무보고 조회
  const report = await prisma.dailyReport.findUnique({
    where: {
      userId_date: {
        userId: user.id,
        date: today
      }
    }
  });
  
  if (report) {
    console.log('\n=== 오늘 업무보고 ===');
    console.log('출근:', report.clockIn);
    console.log('퇴근:', report.clockOut);
    console.log('통화:', report.callLogsCreated);
    console.log('메모:', report.memosCreated);
    console.log('생성 시간:', report.createdAt);
    console.log('수정 시간:', report.updatedAt);
  } else {
    console.log('오늘 업무보고가 없습니다.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
