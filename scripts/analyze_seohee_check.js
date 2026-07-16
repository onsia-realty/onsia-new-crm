/**
 * 서희 명단 읽기전용 분석 (등록 안 함)
 * - 전화 추출, 리스트 내 중복, 형식 이상, DB 기존 존재(현장/배정/공개 분류)
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const SRC = 'scripts/seohee_check.txt';

function extractPhone(line) {
  const m = line.match(/01[016789][\s\-]*\d{3,4}[\s\-]*\d{4}/);
  return m ? m[0].replace(/\D/g, '') : null;
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const raw = fs.readFileSync(SRC, 'utf-8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const phones = raw.map(extractPhone);
    const withPhone = phones.filter(Boolean);
    console.log(`총 행: ${raw.length} | 전화 추출된 행: ${withPhone.length} | 전화 없는 행: ${raw.length - withPhone.length}`);

    // 리스트 내 중복
    const count = {};
    withPhone.forEach((p) => { count[p] = (count[p] || 0) + 1; });
    const dupPhones = Object.entries(count).filter(([, c]) => c > 1);
    const listDupExtra = withPhone.length - Object.keys(count).length;
    console.log(`\n고유 전화번호: ${Object.keys(count).length}건`);
    console.log(`리스트 내 중복(2회 이상 등장): ${dupPhones.length}종 / 중복분 ${listDupExtra}건`);
    dupPhones.slice(0, 40).forEach(([p, c]) => console.log(`   ${p} ×${c}`));

    const unique = Object.keys(count);
    const valid = unique.filter((p) => /^010[1-9]\d{7}$/.test(p));
    const invalid = unique.filter((p) => !/^010[1-9]\d{7}$/.test(p));
    console.log(`\n형식 정상: ${valid.length}건 | 형식 이상: ${invalid.length}건`);
    if (invalid.length) console.log('   이상:', invalid.join(', '));

    // DB 조회
    const rows = [];
    for (let i = 0; i < valid.length; i += 1000) {
      const found = await prisma.customer.findMany({
        where: { phone: { in: valid.slice(i, i + 1000) }, isDeleted: false },
        select: { phone: true, name: true, assignedSite: true, assignedUserId: true, isPublic: true },
      });
      rows.push(...found);
    }
    const existSet = new Set(rows.map((r) => r.phone));
    const assigned = rows.filter((r) => r.assignedUserId);
    const publicUnassigned = rows.filter((r) => !r.assignedUserId && r.isPublic);
    const inSeohee4 = rows.filter((r) => r.assignedSite === '서희4차');

    // 담당자 이름
    const uids = [...new Set(assigned.map((r) => r.assignedUserId))];
    const users = await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, name: true } });
    const uname = Object.fromEntries(users.map((u) => [u.id, u.name]));

    console.log(`\n=== DB 대조 ===`);
    console.log(`기존 DB 존재: ${existSet.size}건 / 신규(미존재): ${valid.length - existSet.size}건`);
    console.log(`  - 그 중 담당자 배정됨: ${assigned.length}건`);
    console.log(`  - 그 중 미배정 공개DB: ${publicUnassigned.length}건`);
    console.log(`  - 그 중 서희4차(방금 등록분): ${inSeohee4.length}건`);

    // 현장별 분포
    const bySite = {};
    rows.forEach((r) => { const k = r.assignedSite || '(현장없음)'; bySite[k] = (bySite[k] || 0) + 1; });
    console.log('\n기존 존재 건 현장별 분포:');
    Object.entries(bySite).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => console.log(`   ${s}: ${c}`));

    console.log('\n담당자 배정된 기존 고객(전화 | 담당 | 현장 | 이름):');
    assigned.slice(0, 60).forEach((r) =>
      console.log(`   ${r.phone} | ${uname[r.assignedUserId] ?? r.assignedUserId} | ${r.assignedSite ?? '-'} | ${r.name ?? '-'}`));
    if (assigned.length > 60) console.log(`   ... 외 ${assigned.length - 60}건`);
  } finally { await prisma.$disconnect(); }
})();
