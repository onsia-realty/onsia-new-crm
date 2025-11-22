import { prisma } from '../lib/prisma';

async function main() {
  const now = new Date();
  console.log('현재 서버 시간:', now.toISOString());
  console.log('현재 한국 시간:', now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));

  // 오늘 날짜 (한국 시간 기준)
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  koreaTime.setHours(0, 0, 0, 0);
  console.log('\n조회할 날짜 (자정):', koreaTime);

  const user = await prisma.user.findFirst({
    where: { name: '박찬효' }
  });

  if (!user) {
    console.log('박찬효님을 찾을 수 없습니다.');
    return;
  }

  const report = await prisma.dailyReport.findUnique({
    where: {
      userId_date: {
        userId: user.id,
        date: koreaTime
      }
    }
  });

  if (report) {
    console.log('\n=== 오늘 업무보고 ===');
    console.log('출근 (UTC):', report.clockIn);
    console.log('퇴근 (UTC):', report.clockOut);
    if (report.clockIn) {
      console.log('출근 (KST):', new Date(report.clockIn).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
    }
    if (report.clockOut) {
      console.log('퇴근 (KST):', new Date(report.clockOut).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
    }
  } else {
    console.log('\n오늘 업무보고가 없습니다.');
  }

  // 최근 5일 데이터 조회
  console.log('\n=== 최근 업무보고 ===');
  const reports = await prisma.dailyReport.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
    take: 5
  });

  for (const r of reports) {
    const dateStr = r.date.toLocaleDateString('ko-KR');
    const clockInStr = r.clockIn ? new Date(r.clockIn).toLocaleTimeString('ko-KR') : '없음';
    const clockOutStr = r.clockOut ? new Date(r.clockOut).toLocaleTimeString('ko-KR') : '없음';
    console.log(`날짜: ${dateStr}, 출근: ${clockInStr}, 퇴근: ${clockOutStr}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
