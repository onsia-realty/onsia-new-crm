/**
 * 서희4차 공개DB 등록 + Site 카테고리 생성
 * 사용: node scripts/register_seohee4.js            (dry-run, 분석만)
 *       node scripts/register_seohee4.js --execute  (Site 생성 + 실제 삽입)
 *
 * 원본: scripts/seohee4.txt  (형식: <타입><탭><전화(주석)>)
 * - 타입(59A/75B/79T…)과 주석(여/소유자/사모님…)은 memo에 보존한다.
 * - 제외: 휴대폰 형식 이상, 리스트 내 중복(첫 등장 유지), 이미 DB에 존재하는 번호.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const SRC = 'scripts/seohee4.txt';
const SITE = '서희4차';
const PREFIX = '서희4차';
const ADMIN_ID = 'cmgq7d3220000up2cjmu2y0v0'; // admin@onsia.local
const CHUNK = 500;
const EXECUTE = process.argv.includes('--execute');

// 한 줄 → { type, phone(digits), note }
function parseLine(line) {
  const m = line.match(/01[016789][\s\-]*\d{3,4}[\s\-]*\d{4}/);
  if (!m) return null;
  const phone = m[0].replace(/\D/g, '');
  const type = line.slice(0, m.index).trim().toUpperCase();
  const noteMatch = line.match(/\(([^)]*)\)/);
  const note = noteMatch ? noteMatch[1].trim() : '';
  return { type, phone, note };
}

const memoOf = (type, note) =>
  [type, note ? `(${note})` : ''].filter(Boolean).join(' ');

(async () => {
  const prisma = new PrismaClient();
  try {
    const raw = fs.readFileSync(SRC, 'utf-8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const parsed = raw.map(parseLine).filter(Boolean);
    console.log(`입력: ${raw.length}행 → 전화 추출 ${parsed.length}건`);

    // 리스트 내 중복 제거 (첫 등장 유지)
    const seen = new Set();
    const unique = [];
    let listDup = 0;
    for (const p of parsed) {
      if (seen.has(p.phone)) { listDup++; continue; }
      seen.add(p.phone); unique.push(p);
    }
    console.log(`리스트 내 중복 제거: ${listDup}건 → 고유 ${unique.length}건`);

    // 형식 검증
    const valid = unique.filter((p) => /^010[1-9]\d{7}$/.test(p.phone));
    const invalid = unique.filter((p) => !/^010[1-9]\d{7}$/.test(p.phone));
    console.log(`형식 이상(제외): ${invalid.length}건${invalid.length ? ' → ' + invalid.map((p) => p.phone).join(', ') : ''}`);

    // 기존 DB 존재 검사
    const phones = valid.map((p) => p.phone);
    const existingRows = [];
    for (let i = 0; i < phones.length; i += 1000) {
      const found = await prisma.customer.findMany({
        where: { phone: { in: phones.slice(i, i + 1000) }, isDeleted: false },
        select: { phone: true, assignedUserId: true, assignedSite: true, isPublic: true },
      });
      existingRows.push(...found);
    }
    const existing = new Set(existingRows.map((r) => r.phone));
    const assignedExisting = existingRows.filter((r) => r.assignedUserId);
    console.log(`기존 DB 존재(제외): ${existing.size}건 (그 중 담당자 배정됨: ${assignedExisting.length}건)`);
    if (existingRows.length) {
      existingRows.slice(0, 20).forEach((r) =>
        console.log(`   - ${r.phone} | site=${r.assignedSite ?? '-'} | 배정=${r.assignedUserId ? 'Y' : 'N'} | public=${r.isPublic}`));
    }

    const data = valid.filter((p) => !existing.has(p.phone));
    console.log(`실제 등록 대상: ${data.length}건`);

    // 타입 분포
    const dist = {};
    data.forEach((p) => { const k = p.type || '(무)'; dist[k] = (dist[k] || 0) + 1; });
    console.log('타입 분포:', JSON.stringify(dist));

    const adminOk = await prisma.user.findUnique({ where: { id: ADMIN_ID }, select: { id: true } });
    const siteExists = await prisma.site.findUnique({ where: { name: SITE }, select: { id: true } });
    console.log(`관리자 계정: ${adminOk ? 'OK' : '없음!'} | Site '${SITE}' 존재: ${siteExists ? 'Y' : 'N (신규 생성 예정)'}`);

    if (!EXECUTE) {
      console.log(`\n[DRY-RUN] 샘플 (처음 3 / 마지막 2):`);
      [0, 1, 2, data.length - 2, data.length - 1].forEach((i) =>
        console.log(`  ${data[i].phone} | ${PREFIX} ${String(i + 1).padStart(4, '0')} | memo="${memoOf(data[i].type, data[i].note)}"`));
      console.log('\n실제 등록: node scripts/register_seohee4.js --execute');
      return;
    }
    if (!adminOk) { console.error('관리자 계정 없음 — 중단'); return; }
    if (data.length === 0) { console.log('등록할 신규 없음. 종료.'); return; }

    // Site 카테고리 생성 (없을 때만)
    if (!siteExists) {
      const maxOrder = (await prisma.site.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
      const site = await prisma.site.create({
        data: { name: SITE, color: 'pink', icon: '🏙️', sortOrder: maxOrder + 10, isActive: true, createdById: ADMIN_ID },
      });
      console.log(`Site 생성: ${site.icon} ${site.name} (sortOrder=${site.sortOrder})`);
    }

    const startOrder = ((await prisma.customer.aggregate({ _min: { displayOrder: true } }))._min.displayOrder ?? 0) - data.length;
    console.log(`displayOrder 시작: ${startOrder}`);

    const now = new Date();
    let success = 0;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      await prisma.customer.createMany({
        data: chunk.map((p, j) => ({
          phone: p.phone,
          name: `${PREFIX} ${String(i + j + 1).padStart(4, '0')}`,
          assignedUserId: null,
          assignedAt: null,
          assignedSite: SITE,
          isDuplicate: false,
          displayOrder: startOrder + i + j,
          memo: memoOf(p.type, p.note),
          isPublic: true,
          publicAt: now,
          publicById: ADMIN_ID,
        })),
      });
      success += chunk.length;
      console.log(`청크 완료 (누적 ${success}/${data.length})`);
    }

    await prisma.auditLog.create({
      data: {
        userId: ADMIN_ID,
        action: 'CREATE',
        entity: 'Customer',
        changes: {
          source: SRC, totalRows: raw.length, success,
          skippedListDuplicate: listDup, skippedInvalid: invalid.length, skippedExisting: existing.size,
          assignedSite: SITE, namePrefix: PREFIX, isPublic: true, mode: 'seohee4-public-bulk',
        },
      },
    });

    console.log(`\n✅ 등록 완료: ${success}건`);
  } catch (e) {
    console.error('ERROR:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
