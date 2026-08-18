/**
 * 안산 힐스테이트 오피스텔 방문자 디비 — 등록 전 분석 + DB 대조 (읽기 전용)
 * 사용: node scripts/check_hillstate.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const SRC = 'scripts/hillstate.txt';

function classify(p) {
  if (/^010[2-9]\d{7}$/.test(p)) return 'OK';
  if (/^010/.test(p) && p.length > 11) return `자릿수초과(${p.length})`;
  if (/^010[01]/.test(p) && p.length === 11) return '010-0xxx/1xxx(더미·불가)';
  if (/^01[16789]/.test(p)) return '구형 011/016/017/019';
  if (/^0[2-6]/.test(p)) return '유선(지역번호)';
  if (/^1/.test(p) && p.length === 10) return '앞 0 누락 추정(10자리)';
  if (p.length < 10) return `자릿수부족(${p.length})`;
  return '기타';
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const raw = fs
      .readFileSync(SRC, 'utf-8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        const [name, gender, age, phone, area] = l.split('\t');
        return { name: name || '', gender: gender || '', age: age || '', phone: phone || '', area: area || '' };
      });
    console.log(`입력 행수: ${raw.length}`);

    const buckets = {};
    for (const r of raw) {
      const k = classify(r.phone);
      buckets[k] = (buckets[k] || 0) + 1;
    }
    console.log('\n번호 형식 분류:');
    Object.entries(buckets).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

    const seen = new Set();
    const candidates = [];
    let listDup = 0;
    for (const r of raw) {
      if (classify(r.phone) !== 'OK') continue;
      if (seen.has(r.phone)) { listDup++; continue; }
      seen.add(r.phone);
      candidates.push(r);
    }
    console.log(`\n유효 형식 중 리스트 내 중복 제외: ${listDup}건`);
    console.log(`후보(고유·유효): ${candidates.length}건`);

    const phones = candidates.map((c) => c.phone);
    const found = [];
    for (let i = 0; i < phones.length; i += 1000) {
      const chunk = await prisma.customer.findMany({
        where: { phone: { in: phones.slice(i, i + 1000) } },
        select: {
          phone: true, name: true, assignedSite: true, isPublic: true,
          isDeleted: true, assignedUserId: true,
          assignedUser: { select: { name: true } },
        },
      });
      found.push(...chunk);
    }
    const uniqFound = new Set(found.map((f) => f.phone));
    console.log(`\n기존 DB 존재: ${uniqFound.size}개 번호 (레코드 ${found.length}건)`);
    const alive = found.filter((f) => !f.isDeleted);
    console.log(`  - 살아있는 레코드: ${alive.length}건`);
    const assigned = alive.filter((f) => f.assignedUserId);
    console.log(`  - 담당자 배정됨: ${assigned.length}건`);
    console.log(`  - 공개DB 미배정: ${alive.filter((f) => !f.assignedUserId && f.isPublic).length}건`);
    console.log(`  - 비공개·미배정: ${alive.filter((f) => !f.assignedUserId && !f.isPublic).length}건`);

    const bySite = {};
    alive.forEach((f) => { const k = f.assignedSite || '(없음)'; bySite[k] = (bySite[k] || 0) + 1; });
    console.log('\n기존 건 현장 분포:');
    Object.entries(bySite).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

    if (assigned.length) {
      const byUser = {};
      assigned.forEach((f) => { const n = f.assignedUser?.name || '?'; byUser[n] = (byUser[n] || 0) + 1; });
      console.log('\n배정 담당자 분포(상위 15):');
      Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    }

    console.log(`\n▶ 실제 신규 등록 대상: ${candidates.filter((c) => !uniqFound.has(c.phone)).length}건`);
  } catch (e) {
    console.error('ERROR:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
