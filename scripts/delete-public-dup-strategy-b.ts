/**
 * 전략 B: 공개DB 중복 179건 소프트 삭제
 *
 * 삭제 대상:
 *   1. 외부 중복 (공개DB phone이 비공개 DB에도 존재) → 해당 공개DB 레코드 전부 삭제
 *   2. 블랙리스트 중복 (공개DB phone이 블랙리스트에 있음) → 해당 공개DB 레코드 전부 삭제
 *   3. 내부 중복 (공개DB 안에서 같은 phone 2건 이상) → 가장 오래된 1건만 남기고 나머지 삭제
 *
 * 안전 장치:
 *   - isDeleted=true 로 소프트 삭제만 (언제든 복구 가능)
 *   - 실행 전 대상 재계산 후 예상(179)과 일치할 때만 진행
 *   - 500건씩 배치 처리
 *   - AuditLog에 삭제 사유 기록
 *   - 검증: 삭제 후 공개DB 중복 0 확인
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXPECTED_DELETE = 178; // 179 → 178: 블랙과 외부가 겹치는 phone 1건 때문
const EXPECTED_FINAL = 3629; // 3807 - 178
const BATCH_SIZE = 500;

async function main() {
  // 실행자 (admin 계정 사용)
  const admin = await prisma.user.findUnique({
    where: { username: 'admin' },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error('admin 계정 없음');

  console.log(`🧾 실행자: ${admin.name} (admin)`);

  // 현재 공개DB
  const publicCustomers = await prisma.customer.findMany({
    where: { isPublic: true, isDeleted: false },
    select: { id: true, phone: true, createdAt: true },
  });
  const beforeCount = publicCustomers.length;
  console.log(`📊 현재 공개DB: ${beforeCount}건`);

  const publicPhones = Array.from(new Set(publicCustomers.map((c) => c.phone)));

  // ────────────────────────────────
  // 1) 외부 중복 phone 수집
  // ────────────────────────────────
  const privateMatches = await prisma.customer.findMany({
    where: {
      phone: { in: publicPhones },
      isPublic: false,
      isDeleted: false,
    },
    select: { phone: true },
  });
  const externalPhones = new Set(privateMatches.map((m) => m.phone));

  // ────────────────────────────────
  // 2) 블랙리스트 phone 수집
  // ────────────────────────────────
  const blacklistMatches = await prisma.blacklist.findMany({
    where: { isActive: true, phone: { in: publicPhones } },
    select: { phone: true },
  });
  const blacklistPhones = new Set(blacklistMatches.map((b) => b.phone));

  // ────────────────────────────────
  // 삭제 대상 ID 수집
  // ────────────────────────────────
  // 우선순위: 외부/블랙은 전체 제거, 나머지 내부 중복은 가장 오래된 1건만 남김
  const removeEntirelyPhones = new Set<string>([...externalPhones, ...blacklistPhones]);

  const toDelete: {
    id: string;
    phone: string;
    reason: 'external' | 'blacklist' | 'internal';
  }[] = [];

  // phone → records 매핑
  const phoneToRecords = new Map<string, typeof publicCustomers>();
  publicCustomers.forEach((c) => {
    if (!phoneToRecords.has(c.phone)) phoneToRecords.set(c.phone, []);
    phoneToRecords.get(c.phone)!.push(c);
  });

  for (const [phone, records] of phoneToRecords.entries()) {
    if (removeEntirelyPhones.has(phone)) {
      // 외부 또는 블랙 중복 → 해당 phone의 공개DB 전체 제거
      const reason = externalPhones.has(phone) ? 'external' : 'blacklist';
      records.forEach((r) => toDelete.push({ id: r.id, phone, reason }));
    } else if (records.length > 1) {
      // 내부 중복 → 가장 오래된 1건 제외하고 나머지 삭제
      const sorted = [...records].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const keep = sorted[0];
      sorted.slice(1).forEach((r) => {
        toDelete.push({ id: r.id, phone, reason: 'internal' });
      });
      // 만약 keep도 외부/블랙이면 위 분기에서 처리했을 것이므로 여기서는 안전
      void keep;
    }
  }

  // 중복 ID 제거 (혹시 외부 + 블랙이 겹치는 경우 대비)
  const dedupMap = new Map<string, (typeof toDelete)[number]>();
  toDelete.forEach((d) => {
    if (!dedupMap.has(d.id)) dedupMap.set(d.id, d);
  });
  const finalToDelete = Array.from(dedupMap.values());

  // 사유별 카운트
  const byReason = { external: 0, blacklist: 0, internal: 0 };
  finalToDelete.forEach((d) => byReason[d.reason]++);

  console.log();
  console.log(`🎯 삭제 예정: ${finalToDelete.length}건`);
  console.log(`    - 외부 중복 제거: ${byReason.external}건`);
  console.log(`    - 블랙 중복 제거: ${byReason.blacklist}건`);
  console.log(`    - 내부 중복 정리: ${byReason.internal}건`);
  console.log();

  if (finalToDelete.length !== EXPECTED_DELETE) {
    console.error(
      `❌ 삭제 건수가 예상과 다릅니다. 안전을 위해 중단. (실제 ${finalToDelete.length} vs 예상 ${EXPECTED_DELETE})`
    );
    process.exit(1);
  }

  // ────────────────────────────────
  // 소프트 삭제 실행 (배치)
  // ────────────────────────────────
  console.log(`🔄 소프트 삭제 중...`);
  const now = new Date();
  let deletedTotal = 0;
  for (let i = 0; i < finalToDelete.length; i += BATCH_SIZE) {
    const batch = finalToDelete.slice(i, i + BATCH_SIZE);
    const result = await prisma.customer.updateMany({
      where: { id: { in: batch.map((d) => d.id) } },
      data: { isDeleted: true, updatedAt: now },
    });
    deletedTotal += result.count;
    console.log(`  ✓ 배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(finalToDelete.length / BATCH_SIZE)}: ${result.count}건`);
  }
  console.log(`  ✓ 총 ${deletedTotal}건 소프트 삭제 완료`);

  // ────────────────────────────────
  // 검증
  // ────────────────────────────────
  console.log();
  console.log(`🔍 검증...`);
  const afterPublicCount = await prisma.customer.count({
    where: { isPublic: true, isDeleted: false },
  });
  console.log(`  공개DB 남은 건수: ${afterPublicCount}건 (예상: ${EXPECTED_FINAL}건)`);

  // 공개DB 내 중복 phone 재계산
  const remainingDupGroups = await prisma.customer.groupBy({
    by: ['phone'],
    where: { isPublic: true, isDeleted: false },
    _count: { phone: true },
    having: { phone: { _count: { gt: 1 } } },
  });
  console.log(`  공개DB 내 내부 중복 phone: ${remainingDupGroups.length}개 (목표 0)`);

  // 외부 중복 재계산
  const remainingPublicPhones = await prisma.customer.findMany({
    where: { isPublic: true, isDeleted: false },
    select: { phone: true },
  });
  const remainingPhoneSet = Array.from(new Set(remainingPublicPhones.map((c) => c.phone)));
  const remainingExternal = await prisma.customer.count({
    where: {
      phone: { in: remainingPhoneSet },
      isPublic: false,
      isDeleted: false,
    },
  });
  console.log(`  남은 외부 중복 건수: ${remainingExternal}건 (목표 0)`);

  const remainingBlacklist = await prisma.blacklist.count({
    where: { isActive: true, phone: { in: remainingPhoneSet } },
  });
  console.log(`  남은 블랙 중복 건수: ${remainingBlacklist}건 (목표 0)`);

  if (afterPublicCount !== EXPECTED_FINAL || remainingDupGroups.length > 0 || remainingExternal > 0 || remainingBlacklist > 0) {
    console.error(`\n⚠️  검증 실패. DB 상태를 직접 확인해주세요.`);
    process.exit(1);
  }

  // ────────────────────────────────
  // 감사 로그
  // ────────────────────────────────
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'SOFT_DELETE',
      entity: 'Customer',
      entityId: `공개DB 중복 정리 ${finalToDelete.length}건`,
      changes: JSON.parse(
        JSON.stringify({
          strategy: 'B',
          total: finalToDelete.length,
          external: byReason.external,
          blacklist: byReason.blacklist,
          internal: byReason.internal,
          before: beforeCount,
          after: afterPublicCount,
        })
      ),
    },
  });
  console.log(`\n✅ 감사 로그 기록 완료`);
  console.log(`\n🎉 완료: 공개DB ${beforeCount} → ${afterPublicCount}건 (${finalToDelete.length}건 정리)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ 오류:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
