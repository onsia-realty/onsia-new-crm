/**
 * 안산 중앙역 아피체 방명록 — 등록 전 DB 대조 분석 (읽기 전용)
 * 사용: node scripts/check_ansan_apiche.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const SRC = 'scripts/ansan_apiche.txt';

(async () => {
  const prisma = new PrismaClient();
  try {
    const raw = fs
      .readFileSync(SRC, 'utf-8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        const [name, area, phone] = l.split('\t');
        return { name: name || '', area: area || '', phone: phone || '' };
      });
    console.log(`입력 행수: ${raw.length}`);

    const valid = [];
    const invalid = [];
    const seen = new Set();
    let listDup = 0;
    for (const r of raw) {
      if (!/^010[2-9]\d{7}$/.test(r.phone)) { invalid.push(r); continue; }
      if (seen.has(r.phone)) { listDup++; continue; }
      seen.add(r.phone);
      valid.push(r);
    }
    console.log(`형식 이상 제외: ${invalid.length}건`);
    console.log(`리스트 내 중복 제외: ${listDup}건`);
    console.log(`후보(고유·유효): ${valid.length}건`);

    const phones = valid.map((v) => v.phone);
    const found = [];
    for (let i = 0; i < phones.length; i += 1000) {
      const chunk = await prisma.customer.findMany({
        where: { phone: { in: phones.slice(i, i + 1000) } },
        select: {
          id: true, phone: true, name: true, assignedSite: true, isPublic: true,
          isDeleted: true, assignedUserId: true,
          assignedUser: { select: { name: true } },
        },
      });
      found.push(...chunk);
    }
    console.log(`\n기존 DB 존재: ${found.length}건`);
    const alive = found.filter((f) => !f.isDeleted);
    console.log(`  - 살아있는 레코드: ${alive.length}건 (삭제됨 ${found.length - alive.length}건)`);
    const assigned = alive.filter((f) => f.assignedUserId);
    console.log(`  - 담당자 배정됨: ${assigned.length}건`);
    const publicUnassigned = alive.filter((f) => !f.assignedUserId && f.isPublic);
    console.log(`  - 공개DB 미배정: ${publicUnassigned.length}건`);
    const other = alive.filter((f) => !f.assignedUserId && !f.isPublic);
    console.log(`  - 비공개·미배정: ${other.length}건`);

    const bySite = {};
    alive.forEach((f) => { bySite[f.assignedSite || '(없음)'] = (bySite[f.assignedSite || '(없음)'] || 0) + 1; });
    console.log('\n기존 건 현장 분포:');
    Object.entries(bySite).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

    if (assigned.length) {
      const byUser = {};
      assigned.forEach((f) => { const n = f.assignedUser?.name || '?'; byUser[n] = (byUser[n] || 0) + 1; });
      console.log('\n배정 담당자 분포:');
      Object.entries(byUser).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    }

    const existingSet = new Set(found.map((f) => f.phone));
    console.log(`\n▶ 실제 신규 등록 대상: ${valid.filter((v) => !existingSet.has(v.phone)).length}건`);

    const site = await prisma.site.findFirst({ where: { name: { contains: '아피체' } } });
    console.log(`\nSite 테이블 '아피체' 레코드: ${site ? JSON.stringify(site) : '없음'}`);
  } catch (e) {
    console.error('ERROR:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
