/**
 * 수원용인 카 오더.xlsx 분석 (읽기 전용, 등록 안 함)
 * - 전화 8자리 → 010 접두어. 상태(열2) 분포, 형식, 리스트 중복, 기존 DB 충돌.
 */
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

function toPhone(raw) {
  const d = String(raw).replace(/\D/g, '');
  if (d.length === 8) return '010' + d;
  if (d.length === 11 && d.startsWith('010')) return d;
  if (d.length === 10 && d.startsWith('10')) return '0' + d;
  return null; // 형식 이상
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const wb = XLSX.readFile('D:/DB/수원용인 카 오더.xlsx');
    const all = [];
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
      rows.forEach((r) => all.push({ raw: r[0], status: String(r[2] ?? '').trim(), sheet: name }));
    }
    const nonEmpty = all.filter((r) => String(r.raw).trim() !== '');
    console.log(`총 데이터행: ${nonEmpty.length}`);

    // 상태(열2) 분포
    const statusDist = {};
    nonEmpty.forEach((r) => {
      const key = r.status === '' ? '(빈값)' : (r.status.length > 10 ? '(메모)' : r.status);
      statusDist[key] = (statusDist[key] || 0) + 1;
    });
    console.log('\n상태(열2) 분포:');
    Object.entries(statusDist).sort((a, b) => b[1] - a[1]).forEach(([k, c]) => console.log(`   ${k}: ${c}`));

    // 전화 정규화
    const parsed = nonEmpty.map((r) => ({ ...r, phone: toPhone(r.raw) }));
    const invalid = parsed.filter((r) => !r.phone || !/^010[1-9]\d{7}$/.test(r.phone));
    const valid = parsed.filter((r) => r.phone && /^010[1-9]\d{7}$/.test(r.phone));
    console.log(`\n형식 정상: ${valid.length} | 형식 이상: ${invalid.length}`);
    if (invalid.length) console.log('   이상 샘플:', invalid.slice(0, 10).map((r) => `${r.raw}→${r.phone}`).join(', '));

    // 리스트 내 중복
    const seen = new Set();
    let listDup = 0;
    valid.forEach((r) => { if (seen.has(r.phone)) listDup++; else seen.add(r.phone); });
    console.log(`리스트 내 중복: ${listDup} → 고유 ${seen.size}`);

    // 기존 DB 조회
    const uniquePhones = [...seen];
    const rows = [];
    for (let i = 0; i < uniquePhones.length; i += 1000) {
      const found = await prisma.customer.findMany({
        where: { phone: { in: uniquePhones.slice(i, i + 1000) }, isDeleted: false },
        select: { phone: true, assignedUserId: true, assignedSite: true },
      });
      rows.push(...found);
    }
    const existSet = new Set(rows.map((r) => r.phone));
    const assignedOther = rows.filter((r) => r.assignedUserId);
    console.log(`\n기존 DB 존재: ${existSet.size} | 신규: ${uniquePhones.length - existSet.size}`);
    console.log(`  - 그 중 담당자 배정됨: ${assignedOther.length}`);

    // 담당자별 분포
    const uids = [...new Set(assignedOther.map((r) => r.assignedUserId))];
    const users = await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, name: true } });
    const uname = Object.fromEntries(users.map((u) => [u.id, u.name]));
    const byUser = {};
    assignedOther.forEach((r) => { const n = uname[r.assignedUserId] ?? r.assignedUserId; byUser[n] = (byUser[n] || 0) + 1; });
    console.log('  담당자별:', JSON.stringify(byUser));

    // 추재현 확인
    const cjh = await prisma.user.findFirst({ where: { username: 'cnwogus0127' }, select: { id: true, name: true } });
    console.log(`\n추재현: ${cjh ? cjh.name + ' / ' + cjh.id : '없음!'}`);
  } finally { await prisma.$disconnect(); }
})();
