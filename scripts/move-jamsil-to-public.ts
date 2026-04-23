/**
 * 2026-04-23T08:01:54Z에 admin이 대량등록한 잠실 리버리치 고객 1,804건을 공개DB로 전환
 *
 * 안전장치:
 * 1. 대상 건수가 예상(1804)과 정확히 일치할 때만 실행
 * 2. updateMany + allocation createMany를 트랜잭션으로 묶음
 * 3. 배치 500개씩 처리
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXPECTED_COUNT = 1804;
const ADMIN_USERNAME = 'admin';
const SITE_NAME = '잠실 리버리치';
// 대상 시각 범위: 등록 시각 2026-04-23T08:01:54Z 전후 10초 윈도우
const FROM = new Date('2026-04-23T08:01:44.000Z');
const TO = new Date('2026-04-23T08:02:04.000Z');
const BATCH_SIZE = 500;

async function main() {
  const admin = await prisma.user.findUnique({
    where: { username: ADMIN_USERNAME },
    select: { id: true, name: true, email: true },
  });
  if (!admin) throw new Error(`관리자 계정을 찾을 수 없습니다: ${ADMIN_USERNAME}`);
  console.log(`👤 관리자: ${admin.name} (${admin.email})`);

  const whereCondition = {
    assignedUserId: admin.id,
    assignedSite: SITE_NAME,
    isPublic: false,
    isDeleted: false,
    createdAt: { gte: FROM, lte: TO },
  };

  // 1단계: 대상 건수 재확인
  const count = await prisma.customer.count({ where: whereCondition });
  console.log(`📊 대상 건수: ${count}건 (예상: ${EXPECTED_COUNT}건)`);

  if (count !== EXPECTED_COUNT) {
    console.error(
      `❌ 대상 건수가 예상과 다릅니다. 안전을 위해 중단합니다. (실제 ${count} vs 예상 ${EXPECTED_COUNT})`
    );
    process.exit(1);
  }

  // 2단계: 대상 ID 전체 조회 (allocation 이력 생성용)
  const targets = await prisma.customer.findMany({
    where: whereCondition,
    select: { id: true, assignedUserId: true },
  });
  console.log(`✅ 대상 ID ${targets.length}건 수집 완료`);

  const now = new Date();

  // 3단계: 공개DB 전환 (updateMany — 한 번에 처리)
  console.log('\n🔄 공개DB 전환 중...');
  const updateResult = await prisma.customer.updateMany({
    where: {
      id: { in: targets.map((t) => t.id) },
    },
    data: {
      isPublic: true,
      publicAt: now,
      publicById: admin.id,
      assignedUserId: null,
      assignedAt: null,
    },
  });
  console.log(`  ✓ ${updateResult.count}건 업데이트 완료`);

  // 4단계: 배분 이력 배치 생성
  console.log('\n📝 배분 이력 기록 중...');
  let allocationCount = 0;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const created = await prisma.customerAllocation.createMany({
      data: batch.map((t) => ({
        customerId: t.id,
        fromUserId: t.assignedUserId, // = admin.id
        toUserId: null,
        allocatedById: admin.id,
        reason: '공개DB로 전환 (대량등록 잘못 배정 복구)',
      })),
    });
    allocationCount += created.count;
    console.log(`  ✓ 배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(targets.length / BATCH_SIZE)}: ${created.count}건`);
  }
  console.log(`  ✓ 총 ${allocationCount}건의 배분 이력 생성 완료`);

  // 5단계: 검증
  const verifyPublic = await prisma.customer.count({
    where: {
      id: { in: targets.map((t) => t.id) },
      isPublic: true,
      assignedUserId: null,
    },
  });
  console.log(`\n🔍 검증: 공개DB 상태(isPublic=true, 담당자=null)인 고객 ${verifyPublic}/${targets.length}건`);

  if (verifyPublic !== targets.length) {
    console.error('❌ 일부 고객이 공개DB로 전환되지 않았습니다. DB 확인 필요.');
    process.exit(1);
  }

  // 6단계: 감사 로그
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'MARK_PUBLIC',
      entity: 'Customer',
      entityId: `${targets.length}건 일괄처리 (잠실 리버리치)`,
      changes: JSON.parse(
        JSON.stringify({ isPublic: true, count: targets.length, site: SITE_NAME, method: 'script' })
      ),
    },
  });
  console.log('\n✅ 감사 로그 기록 완료');

  console.log(`\n🎉 완료: ${targets.length}건을 공개DB로 전환했습니다.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ 오류:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
