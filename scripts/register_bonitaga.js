/**
 * 보니타가 디비정리 → 공개DB 등록
 * 사용: node scripts/register_bonitaga.js            (dry-run)
 *       node scripts/register_bonitaga.js --execute  (실제 등록)
 *
 * 입력: scripts/bonitaga.txt (탭 구분: 이름 / 번호숫자 / 관심도 / 플래그 / 상담내용)
 *       원본 전화번호가 8자리(앞 010 생략)라 추출 단계에서 010을 붙여 정규화함.
 * 제외: 형식 이상(010[2-9]xxxxxxx 미통과), 리스트 내 중복(첫 등장만), 이미 DB에 존재하는 번호
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const EXECUTE = process.argv.includes('--execute');
const SRC = 'scripts/bonitaga.txt';
const SITE = '보니타가';
const ADMIN_ID = 'cmgq7d3220000up2cjmu2y0v0'; // admin@onsia.local
const CHUNK = 500;

(async () => {
  const prisma = new PrismaClient();
  try {
    const raw = fs
      .readFileSync(SRC, 'utf-8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        const [name, phone] = l.split('\t');
        return { name: (name || '').trim(), phone: (phone || '').trim() };
      });
    console.log(`입력 행수: ${raw.length}`);

    const seen = new Set();
    let invalid = 0;
    let listDup = 0;
    const candidates = [];
    for (const r of raw) {
      if (!/^010[2-9]\d{7}$/.test(r.phone)) { invalid++; continue; }
      if (seen.has(r.phone)) { listDup++; continue; }
      seen.add(r.phone);
      candidates.push(r);
    }
    console.log(`형식 이상 제외: ${invalid}건`);
    console.log(`리스트 내 중복 제외: ${listDup}건`);
    console.log(`후보: ${candidates.length}건`);

    const existing = new Set();
    const phones = candidates.map((c) => c.phone);
    for (let i = 0; i < phones.length; i += 1000) {
      const found = await prisma.customer.findMany({
        where: { phone: { in: phones.slice(i, i + 1000) } },
        select: { phone: true },
      });
      found.forEach((c) => existing.add(c.phone));
    }
    console.log(`기존 DB 존재 제외: ${existing.size}건`);

    const data = candidates.filter((c) => !existing.has(c.phone));
    console.log(`실제 등록 대상: ${data.length}건`);
    if (data.length === 0) { console.log('등록할 신규 없음. 종료.'); return; }

    const agg = await prisma.customer.aggregate({ _min: { displayOrder: true } });
    const startOrder = (agg._min.displayOrder ?? 0) - data.length;
    console.log(`displayOrder 시작: ${startOrder} (현재 최소 ${agg._min.displayOrder})`);

    const nameOf = (r) => r.name || `보니타가 고객_${r.phone.slice(-4)}`;

    if (!EXECUTE) {
      const preview = [...new Set([0, 1, 2, data.length - 2, data.length - 1])].filter((i) => i >= 0 && i < data.length);
      console.log(`\n[DRY-RUN] 현장="${SITE}" — 미리보기:`);
      preview.forEach((i) => console.log(`  ${data[i].phone} | ${nameOf(data[i])}`));
      console.log(`이름 자동생성 대상: ${data.filter((r) => !r.name).length}건`);
      console.log('실제 등록하려면 --execute 플래그로 재실행.');
      return;
    }

    // 현장(Site) 레코드 보장
    const maxSite = await prisma.site.aggregate({ _max: { sortOrder: true } });
    const site = await prisma.site.upsert({
      where: { name: SITE },
      update: {},
      create: {
        name: SITE,
        color: 'fuchsia',
        icon: '🏢',
        sortOrder: (maxSite._max.sortOrder ?? 0) + 10,
        isActive: true,
        createdById: ADMIN_ID,
      },
    });
    console.log(`Site 레코드: ${site.name} (sortOrder ${site.sortOrder})`);

    const now = new Date();
    let success = 0;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      await prisma.customer.createMany({
        data: chunk.map((r, j) => ({
          phone: r.phone,
          name: nameOf(r),
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
          source: '보니타가 디비정리.xlsx',
          totalRows: raw.length,
          success,
          skippedInvalid: invalid,
          skippedListDuplicate: listDup,
          skippedExisting: existing.size,
          assignedSite: SITE,
          isPublic: true,
          phoneNormalization: '8자리 원본에 010 접두 부여',
          mode: 'bonitaga-bulk-script',
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
