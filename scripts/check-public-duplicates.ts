/**
 * 공개DB 내 중복 현황 파악 (읽기 전용, 변경 없음)
 *
 * 중복 정의:
 * - 타입1: 공개DB 내부 중복 (같은 phone이 공개DB에 2건 이상)
 * - 타입2: 외부 중복 (공개DB 레코드의 phone이 공개DB 밖에도 존재 = 직원 DB 등)
 * - 타입3: 블랙리스트와 중복
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 전체 공개DB 건수
  const publicTotal = await prisma.customer.count({
    where: { isPublic: true, isDeleted: false },
  });
  console.log(`📊 공개DB 전체: ${publicTotal.toLocaleString()}건\n`);

  // 공개DB 내 phone별 그룹
  const publicPhones = await prisma.customer.groupBy({
    by: ['phone'],
    where: { isPublic: true, isDeleted: false },
    _count: { phone: true },
  });
  const publicPhoneSet = new Set(publicPhones.map((p) => p.phone));
  console.log(`📱 공개DB의 고유 전화번호: ${publicPhoneSet.size.toLocaleString()}개`);

  // 타입1: 공개DB 내부 중복 (같은 phone이 공개DB에 2건 이상)
  const internalDupGroups = publicPhones.filter((p) => p._count.phone > 1);
  const internalDupRecords = internalDupGroups.reduce((sum, g) => sum + g._count.phone, 0);
  console.log(
    `🔁 [내부 중복] 공개DB 내에서 같은 전화번호가 2건 이상: ${internalDupGroups.length}개 전화번호, ${internalDupRecords}건 레코드`
  );

  // 타입2: 외부 중복 (공개DB phone이 비공개 DB에도 존재)
  // 공개DB 전화번호 중 비공개 Customer 테이블에도 존재하는 것
  const publicPhonesArr = Array.from(publicPhoneSet);

  // Prisma IN 절 한도 제약 고려 — 공개DB 1804건 정도면 한 번에 가능
  const externalMatches = await prisma.customer.findMany({
    where: {
      phone: { in: publicPhonesArr },
      isPublic: false,
      isDeleted: false,
    },
    select: { phone: true, assignedUserId: true },
  });
  const externalDupPhoneSet = new Set(externalMatches.map((m) => m.phone));
  console.log(
    `🔗 [외부 중복] 공개DB 전화번호가 비공개 DB(직원/관리자 DB)에도 존재: ${externalDupPhoneSet.size}개 전화번호, ${externalMatches.length}건 외부 레코드`
  );

  // 이 외부 중복에 해당하는 공개DB 레코드 수
  const publicRecordsAffectedByExternalDup = await prisma.customer.count({
    where: {
      isPublic: true,
      isDeleted: false,
      phone: { in: Array.from(externalDupPhoneSet) },
    },
  });
  console.log(
    `   └ 이 중복에 해당하는 공개DB 레코드: ${publicRecordsAffectedByExternalDup}건`
  );

  // 타입3: 블랙리스트 중복
  const blacklistMatches = await prisma.blacklist.findMany({
    where: {
      isActive: true,
      phone: { in: publicPhonesArr },
    },
    select: { phone: true },
  });
  const blacklistPhoneSet = new Set(blacklistMatches.map((b) => b.phone));
  console.log(
    `🚫 [블랙리스트 중복] 공개DB 전화번호가 블랙리스트에도 등록: ${blacklistPhoneSet.size}개 전화번호`
  );

  const publicRecordsInBlacklist = await prisma.customer.count({
    where: {
      isPublic: true,
      isDeleted: false,
      phone: { in: Array.from(blacklistPhoneSet) },
    },
  });
  console.log(
    `   └ 이에 해당하는 공개DB 레코드: ${publicRecordsInBlacklist}건`
  );

  // 종합: 숨길 후보 (중복/블랙리스트 중 어느 하나라도 해당)
  const anyDupPhones = new Set<string>([
    ...internalDupGroups.map((g) => g.phone),
    ...externalDupPhoneSet,
    ...blacklistPhoneSet,
  ]);
  const toHideCount = await prisma.customer.count({
    where: {
      isPublic: true,
      isDeleted: false,
      phone: { in: Array.from(anyDupPhones) },
    },
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📌 요약`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  공개DB 전체:         ${publicTotal.toLocaleString()}건`);
  console.log(`  내부 중복 레코드:    ${internalDupRecords}건 (${internalDupGroups.length}개 번호)`);
  console.log(`  외부 중복 영향:      ${publicRecordsAffectedByExternalDup}건`);
  console.log(`  블랙리스트 영향:     ${publicRecordsInBlacklist}건`);
  console.log(`  ──────────────────────────────`);
  console.log(`  숨김 후보(중복 or 블랙): ${toHideCount.toLocaleString()}건`);
  console.log(`  깨끗한(순수) 공개DB:     ${(publicTotal - toHideCount).toLocaleString()}건`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
