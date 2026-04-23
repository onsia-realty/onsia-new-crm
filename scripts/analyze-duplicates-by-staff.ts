/**
 * 공개DB 중복 레코드가 어떤 담당자에게 분산되어 있는지 분석 (읽기 전용)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 공개DB 전체 phone 수집
  const publicCustomers = await prisma.customer.findMany({
    where: { isPublic: true, isDeleted: false },
    select: { id: true, phone: true, createdAt: true },
  });
  const publicPhones = Array.from(new Set(publicCustomers.map((c) => c.phone)));

  // ────────────────────────────────────────
  // 타입 1: 내부 중복 (공개DB 안에서 같은 번호 2건 이상)
  // ────────────────────────────────────────
  const phoneGroups = new Map<string, typeof publicCustomers>();
  publicCustomers.forEach((c) => {
    if (!phoneGroups.has(c.phone)) phoneGroups.set(c.phone, []);
    phoneGroups.get(c.phone)!.push(c);
  });
  const internalDupGroups = Array.from(phoneGroups.entries()).filter(([, arr]) => arr.length > 1);
  const internalDupRecords = internalDupGroups.reduce((sum, [, arr]) => sum + arr.length, 0);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[타입 1] 공개DB 내부 중복`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${internalDupGroups.length}개 번호 × 평균 ${(internalDupRecords / internalDupGroups.length).toFixed(1)}건 = 총 ${internalDupRecords}건`);
  console.log(`  → 담당자 없음(모두 공개DB). 번호별로 1건만 남기고 나머지 삭제 시 제거될 건수: ${internalDupRecords - internalDupGroups.length}건`);
  console.log();

  // ────────────────────────────────────────
  // 타입 2: 외부 중복 (공개DB phone이 비공개 DB에도 존재)
  // ────────────────────────────────────────
  const privateMatches = await prisma.customer.findMany({
    where: {
      phone: { in: publicPhones },
      isPublic: false,
      isDeleted: false,
    },
    select: {
      id: true,
      phone: true,
      assignedUserId: true,
      assignedAt: true,
      assignedUser: { select: { name: true, username: true, role: true } },
    },
  });

  // 담당자별 집계
  const byStaff = new Map<string, { name: string; username: string; role: string; phones: Set<string> }>();
  const unassigned: string[] = [];
  privateMatches.forEach((m) => {
    if (!m.assignedUserId || !m.assignedUser) {
      unassigned.push(m.phone);
      return;
    }
    const key = m.assignedUserId;
    if (!byStaff.has(key)) {
      byStaff.set(key, {
        name: m.assignedUser.name,
        username: m.assignedUser.username,
        role: m.assignedUser.role,
        phones: new Set(),
      });
    }
    byStaff.get(key)!.phones.add(m.phone);
  });

  const externalDupPhoneSet = new Set(privateMatches.map((m) => m.phone));

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[타입 2] 외부 중복 (공개DB 번호가 비공개 DB에도 존재)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  총 ${externalDupPhoneSet.size}개 중복 번호 / 비공개쪽 ${privateMatches.length}건`);
  console.log();
  console.log(`  담당자별 분포 (비공개 DB 기준):`);
  const sortedStaff = Array.from(byStaff.entries()).sort((a, b) => b[1].phones.size - a[1].phones.size);
  sortedStaff.forEach(([, info]) => {
    console.log(
      `    ${info.role.padEnd(10)} ${info.name.padEnd(10)} (${info.username}): ${info.phones.size}개 중복 번호`
    );
  });
  if (unassigned.length > 0) {
    console.log(`    (미배정 비공개) ${unassigned.length}건`);
  }
  console.log();
  console.log(`  → 공개DB 쪽에서 제거 시: ${externalDupPhoneSet.size}건의 공개DB 레코드 삭제 (비공개 담당자 보호)`);
  console.log();

  // ────────────────────────────────────────
  // 타입 3: 블랙리스트 중복
  // ────────────────────────────────────────
  const blacklistMatches = await prisma.blacklist.findMany({
    where: { isActive: true, phone: { in: publicPhones } },
    select: {
      phone: true,
      name: true,
      reason: true,
      registeredBy: { select: { name: true, username: true } },
    },
  });
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[타입 3] 블랙리스트 중복`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${blacklistMatches.length}개 번호가 블랙리스트에 등록됨`);
  blacklistMatches.forEach((b) => {
    console.log(
      `    ${b.phone} | ${b.name || '(이름없음)'} | 사유: ${b.reason} | 등록: ${b.registeredBy?.name || '(없음)'}`
    );
  });
  console.log(`  → 공개DB 쪽에서 제거 시: ${blacklistMatches.length}건 삭제`);
  console.log();

  // ────────────────────────────────────────
  // 종합 제안
  // ────────────────────────────────────────
  const allProblemPhones = new Set<string>([
    ...internalDupGroups.map(([phone]) => phone),
    ...externalDupPhoneSet,
    ...blacklistMatches.map((b) => b.phone),
  ]);
  const totalAffectedPublic = await prisma.customer.count({
    where: { isPublic: true, isDeleted: false, phone: { in: Array.from(allProblemPhones) } },
  });

  // 만약 각 번호당 1건만 남기고 나머지 삭제한다면 = "중복을 완전히 없애는" 전략
  const uniquePublicAfter = await prisma.customer.count({
    where: { isPublic: true, isDeleted: false },
  });

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📌 종합`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  공개DB 전체:                 ${uniquePublicAfter.toLocaleString()}건`);
  console.log(`  문제 번호가 포함된 공개DB:    ${totalAffectedPublic}건`);
  console.log();
  console.log(`  전략 A (문제 공개DB 전부 삭제): ${totalAffectedPublic}건 제거 → ${(uniquePublicAfter - totalAffectedPublic).toLocaleString()}건 남음`);
  console.log(`    - 외부/블랙 중복은 아예 제거, 내부 중복도 '비공개에 이미 있으면 공개에서 제거'`);
  console.log(`    - 단, 내부 중복만 있는 경우(공개에만 2건) 순수 공개DB가 비게 되므로 주의`);
  console.log();

  // 전략 B: 내부 중복은 1건만 남기고, 외부/블랙은 제거
  const internalOnlyPhones = new Set<string>();
  internalDupGroups.forEach(([phone]) => {
    if (!externalDupPhoneSet.has(phone) && !blacklistMatches.some((b) => b.phone === phone)) {
      internalOnlyPhones.add(phone);
    }
  });
  const internalOnlyExtraRecords = internalDupGroups
    .filter(([phone]) => internalOnlyPhones.has(phone))
    .reduce((sum, [, arr]) => sum + arr.length - 1, 0); // 1건씩 남기고 나머지

  const externalAffected = await prisma.customer.count({
    where: {
      isPublic: true,
      isDeleted: false,
      phone: { in: Array.from(externalDupPhoneSet) },
    },
  });
  const blacklistAffected = await prisma.customer.count({
    where: {
      isPublic: true,
      isDeleted: false,
      phone: { in: blacklistMatches.map((b) => b.phone) },
    },
  });
  const strategyBRemove = internalOnlyExtraRecords + externalAffected + blacklistAffected;
  console.log(
    `  전략 B (내부 중복은 1건씩 남기고 나머지 삭제 + 외부/블랙은 공개DB에서 완전 제거): ${strategyBRemove}건 제거 → ${(uniquePublicAfter - strategyBRemove).toLocaleString()}건 남음`
  );
  console.log(`    - 내부 중복 추가 제거: ${internalOnlyExtraRecords}건`);
  console.log(`    - 외부 중복 공개DB 제거: ${externalAffected}건`);
  console.log(`    - 블랙 공개DB 제거: ${blacklistAffected}건`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
