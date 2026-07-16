/**
 * 서희4차 공개DB 추가 등록 (2차분 — scripts/seohee_check.txt)
 * 사용: node scripts/register_seohee4_add.js            (dry-run)
 *       node scripts/register_seohee4_add.js --execute  (실제 삽입)
 *
 * - 이름은 기존 '서희4차 NNNN' 뒤 번호부터 이어서 부여.
 * - 평형(59A/75B/84C/79T…)·주석(주인/여/소유자…)은 memo에 보존.
 * - 제외: 형식 이상, 리스트 내 중복(첫 등장 유지), 이미 DB에 존재하는 번호.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const SRC = 'scripts/seohee_check.txt';
const SITE = '서희4차';
const PREFIX = '서희4차';
const ADMIN_ID = 'cmgq7d3220000up2cjmu2y0v0';
const CHUNK = 500;
const EXECUTE = process.argv.includes('--execute');

function parseLine(line) {
  const m = line.match(/01[016789][\s\-]*\d{3,4}[\s\-]*\d{4}/);
  if (!m) return null;
  const phone = m[0].replace(/\D/g, '');
  const pre = line.slice(0, m.index);
  const noteMatch = line.match(/\(([^)]*)\)/);
  const note = noteMatch ? noteMatch[1].trim() : '';
  let type = '';
  const t1 = pre.match(/\d{2,3}\s*[ABCTabct]\b/);
  if (t1) type = t1[0].replace(/\s+/g, '').toUpperCase();
  else { const t2 = pre.match(/\b(59|75|84|79)\b/); if (t2) type = t2[0]; }
  return { phone, type, note };
}

const memoOf = (type, note) => [type, note ? `(${note})` : ''].filter(Boolean).join(' ');

(async () => {
  const prisma = new PrismaClient();
  try {
    const raw = fs.readFileSync(SRC, 'utf-8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const parsed = raw.map(parseLine).filter(Boolean);
    console.log(`입력: ${raw.length}행 → 전화 추출 ${parsed.length}건`);

    const seen = new Set();
    const unique = [];
    let listDup = 0;
    for (const p of parsed) {
      if (seen.has(p.phone)) { listDup++; continue; }
      seen.add(p.phone); unique.push(p);
    }
    console.log(`리스트 내 중복 제거: ${listDup}건 → 고유 ${unique.length}건`);

    const valid = unique.filter((p) => /^010[1-9]\d{7}$/.test(p.phone));
    const invalid = unique.filter((p) => !/^010[1-9]\d{7}$/.test(p.phone));
    console.log(`형식 이상(제외): ${invalid.length}건${invalid.length ? ' → ' + invalid.map((p) => p.phone).join(', ') : ''}`);

    const phones = valid.map((p) => p.phone);
    const existing = new Set();
    for (let i = 0; i < phones.length; i += 1000) {
      const found = await prisma.customer.findMany({
        where: { phone: { in: phones.slice(i, i + 1000) }, isDeleted: false },
        select: { phone: true },
      });
      found.forEach((c) => existing.add(c.phone));
    }
    console.log(`기존 DB 존재(제외): ${existing.size}건`);

    const data = valid.filter((p) => !existing.has(p.phone));
    console.log(`실제 등록 대상: ${data.length}건`);

    // 기존 서희4차 이름 최대 순번 → 이어서 부여
    const prev = await prisma.customer.findMany({
      where: { assignedSite: SITE, isDeleted: false, name: { startsWith: `${PREFIX} ` } },
      select: { name: true },
    });
    let maxNum = 0;
    prev.forEach((r) => { const n = parseInt(r.name.split(' ')[1], 10); if (n > maxNum) maxNum = n; });
    const startNum = maxNum + 1;
    console.log(`기존 서희4차 ${prev.length}건, 이름 순번 이어서: ${PREFIX} ${String(startNum).padStart(4, '0')} ~`);

    const dist = {};
    data.forEach((p) => { const k = p.type || '(무)'; dist[k] = (dist[k] || 0) + 1; });
    console.log('타입 분포:', JSON.stringify(dist));

    if (!EXECUTE) {
      console.log('\n[DRY-RUN] 샘플 (처음 3 / 마지막 2):');
      [0, 1, 2, data.length - 2, data.length - 1].forEach((i) =>
        console.log(`  ${data[i].phone} | ${PREFIX} ${String(startNum + i).padStart(4, '0')} | memo="${memoOf(data[i].type, data[i].note)}"`));
      console.log('\n실제 등록: node scripts/register_seohee4_add.js --execute');
      return;
    }
    if (data.length === 0) { console.log('등록할 신규 없음. 종료.'); return; }

    const startOrder = ((await prisma.customer.aggregate({ _min: { displayOrder: true } }))._min.displayOrder ?? 0) - data.length;
    console.log(`displayOrder 시작: ${startOrder}`);

    const now = new Date();
    let success = 0;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      await prisma.customer.createMany({
        data: chunk.map((p, j) => ({
          phone: p.phone,
          name: `${PREFIX} ${String(startNum + i + j).padStart(4, '0')}`,
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
          assignedSite: SITE, namePrefix: PREFIX, nameStart: startNum, isPublic: true, mode: 'seohee4-public-bulk-add',
        },
      },
    });

    console.log(`\n✅ 추가 등록 완료: ${success}건`);
  } catch (e) {
    console.error('ERROR:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
