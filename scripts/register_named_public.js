/**
 * 이름+번호 목록(TSV: 이름<TAB>전화) → 공개DB 등록
 * 사용: node scripts/register_named_public.js <파일> <현장> [--execute]
 * 예:   node scripts/register_named_public.js scripts/marina_cube.txt 마리나큐브
 *
 * 제외: 휴대폰 형식 아님(/^010[2-9]\d{7}$/), 리스트 내 중복(첫 등장만), 이미 DB에 존재하는 번호
 * dry-run이 기본. --execute 플래그로만 실제 삽입.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const EXECUTE = process.argv.includes('--execute');
const [SRC, SITE] = args;
const ADMIN_ID = 'cmgq7d3220000up2cjmu2y0v0';
const CHUNK = 500;

(async () => {
  if (!SRC || !SITE) {
    console.error('사용법: node scripts/register_named_public.js <파일> <현장> [--execute]');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const raw = fs
      .readFileSync(SRC, 'utf-8')
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => {
        // 이름이 비어 있을 수 있으므로 line 전체를 trim하지 말고 탭으로 먼저 분리
        const [name, phoneRaw] = line.split('\t');
        return { name: (name || '').trim(), phone: (phoneRaw || '').replace(/\D/g, '') };
      });
    console.log(`입력 데이터: ${raw.length}행`);

    const seen = new Map();
    const unique = [];
    for (const r of raw) {
      if (!r.phone) continue;
      if (!seen.has(r.phone)) {
        seen.set(r.phone, r);
        unique.push(r);
      } else if (!seen.get(r.phone).name && r.name) {
        seen.get(r.phone).name = r.name;
      }
    }
    console.log(`리스트 내 중복 제거: ${raw.length - unique.length}행 → 고유 ${unique.length}건`);

    const valid = unique.filter((r) => /^010[2-9]\d{7}$/.test(r.phone));
    const invalid = unique.filter((r) => !/^010[2-9]\d{7}$/.test(r.phone));
    console.log(`형식 이상(제외): ${invalid.length}건`);
    invalid.forEach((r) => console.log(`  ${r.phone} | ${r.name}`));

    // 기존 DB 조회 (배정 상태까지)
    const phones = valid.map((r) => r.phone);
    const existingRows = [];
    for (let i = 0; i < phones.length; i += 1000) {
      const found = await prisma.customer.findMany({
        where: { phone: { in: phones.slice(i, i + 1000) }, isDeleted: false },
        select: {
          phone: true,
          name: true,
          assignedSite: true,
          isPublic: true,
          assignedUserId: true,
          assignedUser: { select: { name: true } },
        },
      });
      existingRows.push(...found);
    }
    const existing = new Set(existingRows.map((c) => c.phone));
    console.log(`\n기존 DB 존재(제외): 고유번호 ${existing.size}건 / 레코드 ${existingRows.length}건`);

    const bySite = {};
    let assignedCnt = 0;
    const assignedBy = {};
    for (const c of existingRows) {
      const key = c.assignedSite || '(현장없음)';
      bySite[key] = (bySite[key] || 0) + 1;
      if (c.assignedUserId) {
        assignedCnt++;
        const who = c.assignedUser?.name || c.assignedUserId;
        assignedBy[who] = (assignedBy[who] || 0) + 1;
      }
    }
    console.log('  기존건 현장 분포:');
    Object.entries(bySite)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`    ${k}: ${v}`));
    console.log(`  기존건 중 담당자 배정됨: ${assignedCnt}건`);
    Object.entries(assignedBy)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([k, v]) => console.log(`    ${k}: ${v}`));

    const data = valid.filter((r) => !existing.has(r.phone));
    console.log(`\n실제 등록 대상: ${data.length}건 (이름 있음 ${data.filter((r) => r.name).length} / 이름 없음 ${data.filter((r) => !r.name).length})`);
    if (data.length === 0) {
      console.log('등록할 신규 없음. 종료.');
      return;
    }

    const agg = await prisma.customer.aggregate({ _min: { displayOrder: true } });
    const startOrder = (agg._min.displayOrder ?? 0) - data.length;
    console.log(`displayOrder 시작: ${startOrder} (현재 최소 ${agg._min.displayOrder})`);

    const nameOf = (r, i) => r.name || `${SITE} ${String(i + 1).padStart(4, '0')}`;

    if (!EXECUTE) {
      console.log(`\n[DRY-RUN] 현장="${SITE}". 처음 3건 / 마지막 2건:`);
      [0, 1, 2, data.length - 2, data.length - 1]
        .filter((i) => i >= 0 && i < data.length)
        .forEach((i) => console.log(`  ${data[i].phone} | ${nameOf(data[i], i)}`));
      console.log('실제 등록하려면 --execute 플래그로 재실행.');
      return;
    }

    const now = new Date();
    let success = 0;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      await prisma.customer.createMany({
        data: chunk.map((r, j) => ({
          phone: r.phone,
          name: nameOf(r, i + j),
          assignedUserId: null,
          assignedAt: null,
          assignedSite: SITE,
          isDuplicate: false,
          displayOrder: startOrder + i + j,
          memo: '',
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
          source: SRC,
          totalRows: raw.length,
          success,
          skippedListDuplicate: raw.length - unique.length,
          skippedInvalid: invalid.length,
          skippedExisting: existing.size,
          assignedSite: SITE,
          isPublic: true,
          mode: 'named-public-bulk-script',
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
