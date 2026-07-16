/**
 * 수원용인 카 오더.xlsx → 추재현 수기등록(LMS 수기DB) 개인 오더 등록
 * 사용: node scripts/register_carorder.js            (dry-run)
 *       node scripts/register_carorder.js --execute  (실제 삽입)
 *
 * - 전화 8자리 → 010 접두어. 열2 상태(x/부재/메모)는 memo에 보존.
 * - 신규만 등록: 형식이상·리스트중복·기존DB(추재현 본인/타인 포함) 전부 제외.
 * - 담당=추재현, assignedSite='LMS 수기DB', lmsEligible=true, isPublic=false.
 */
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const SRC = 'D:/DB/수원용인 카 오더.xlsx';
const SITE = 'LMS 수기DB';
const OWNER_USERNAME = 'cnwogus0127'; // 추재현
const CHUNK = 500;
const EXECUTE = process.argv.includes('--execute');

function toPhone(raw) {
  const d = String(raw).replace(/\D/g, '');
  if (d.length === 8) return '010' + d;
  if (d.length === 11 && d.startsWith('010')) return d;
  if (d.length === 10 && d.startsWith('10')) return '0' + d;
  return null;
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const wb = XLSX.readFile(SRC);
    const raw = [];
    for (const name of wb.SheetNames) {
      XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
        .forEach((r) => { if (String(r[0]).trim() !== '') raw.push({ raw: r[0], status: String(r[2] ?? '').trim() }); });
    }
    console.log(`총 데이터행: ${raw.length}`);

    // 정규화 + 형식 검증
    const parsed = raw.map((r) => ({ ...r, phone: toPhone(r.raw) }))
      .filter((r) => r.phone && /^010[1-9]\d{7}$/.test(r.phone));
    console.log(`형식 정상: ${parsed.length}`);

    // 리스트 내 중복 제거(첫 등장 유지)
    const seen = new Set();
    const unique = [];
    for (const r of parsed) { if (!seen.has(r.phone)) { seen.add(r.phone); unique.push(r); } }
    console.log(`리스트 중복 제거 → 고유 ${unique.length}`);

    // 기존 DB 존재 제외 (추재현 본인 포함 전부)
    const phones = unique.map((r) => r.phone);
    const existing = new Set();
    for (let i = 0; i < phones.length; i += 1000) {
      const found = await prisma.customer.findMany({
        where: { phone: { in: phones.slice(i, i + 1000) }, isDeleted: false },
        select: { phone: true },
      });
      found.forEach((c) => existing.add(c.phone));
    }
    const data = unique.filter((r) => !existing.has(r.phone));
    console.log(`기존 DB 제외: ${existing.size} → 실제 등록 대상(신규): ${data.length}`);

    const owner = await prisma.user.findFirst({ where: { username: OWNER_USERNAME }, select: { id: true, name: true } });
    if (!owner) { console.error('담당자(추재현) 없음 — 중단'); return; }
    console.log(`담당자: ${owner.name} (${owner.id})`);

    // memo(상태) 분포 미리보기
    const statusN = data.filter((r) => r.status).length;
    console.log(`상태(memo) 있는 건: ${statusN} / 빈값: ${data.length - statusN}`);

    if (!EXECUTE) {
      console.log('\n[DRY-RUN] 샘플 (처음 3 / 마지막 2):');
      [0, 1, 2, data.length - 2, data.length - 1].forEach((i) =>
        console.log(`  ${data[i].phone} | memo="${data[i].status}"`));
      console.log('\n실제 등록: node scripts/register_carorder.js --execute');
      return;
    }
    if (data.length === 0) { console.log('등록할 신규 없음. 종료.'); return; }

    const now = new Date();
    let success = 0;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      await prisma.customer.createMany({
        data: chunk.map((r) => ({
          phone: r.phone,
          name: null,
          assignedUserId: owner.id,
          assignedAt: now,
          assignedSite: SITE,
          lmsEligible: true,
          isPublic: false,
          isDuplicate: false,
          memo: r.status || '',
        })),
      });
      success += chunk.length;
      console.log(`청크 완료 (누적 ${success}/${data.length})`);
    }

    await prisma.auditLog.create({
      data: {
        userId: owner.id,
        action: 'CREATE',
        entity: 'Customer',
        changes: {
          source: SRC, totalRows: raw.length, success,
          assignedSite: SITE, ownerId: owner.id, ownerName: owner.name,
          lmsEligible: true, mode: 'carorder-manual-personal',
        },
      },
    });
    console.log(`\n✅ 등록 완료: ${success}건 → ${owner.name} 수기등록`);
  } catch (e) {
    console.error('ERROR:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
