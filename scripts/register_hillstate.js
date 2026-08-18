/**
 * 안산 힐스테이트 오피스텔 방문자 디비 → 공개DB 등록
 * 사용: node scripts/register_hillstate.js            (dry-run)
 *       node scripts/register_hillstate.js --execute  (실제 등록)
 *
 * 입력: scripts/hillstate.txt (탭 구분: 이름 / 성별 / 나이대 / 번호숫자 / 지역)
 * 제외: 형식 이상(010[2-9]xxxxxxx 미통과), 리스트 내 중복(첫 등장만), 이미 DB에 존재하는 번호
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const EXECUTE = process.argv.includes('--execute');
const SRC = 'scripts/hillstate.txt';
const SITE = '안산 힐스테이트 오피스텔';
const ADMIN_ID = 'cmgq7d3220000up2cjmu2y0v0'; // admin@onsia.local
const CHUNK = 500;

const GENDER = { 남: 'MALE', 여: 'FEMALE' };
const AGE = {
  '20대': 'TWENTIES',
  '30대': 'THIRTIES',
  '40대': 'FORTIES',
  '50대': 'FIFTIES',
  '60대 이상': 'SIXTIES_PLUS',
};

(async () => {
  const prisma = new PrismaClient();
  try {
    const raw = fs
      .readFileSync(SRC, 'utf-8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        const [name, gender, age, phone, area] = l.split('\t');
        return {
          name: (name || '').trim(),
          gender: (gender || '').trim(),
          age: (age || '').trim(),
          phone: (phone || '').trim(),
          area: (area || '').trim(),
        };
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

    const nameOf = (r) => r.name || `힐스테이트 고객_${r.phone.slice(-4)}`;

    if (!EXECUTE) {
      const preview = [...new Set([0, 1, 2, data.length - 2, data.length - 1])].filter((i) => i >= 0 && i < data.length);
      console.log(`\n[DRY-RUN] 현장="${SITE}" — 미리보기:`);
      preview.forEach((i) => {
        const r = data[i];
        console.log(`  ${r.phone} | ${nameOf(r)} | ${GENDER[r.gender] || '-'} | ${AGE[r.age] || '-'} | ${r.area || '(지역없음)'}`);
      });
      console.log(`성별 저장 대상: ${data.filter((r) => GENDER[r.gender]).length}건, 나이대 저장 대상: ${data.filter((r) => AGE[r.age]).length}건`);
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
        color: 'sky',
        icon: '🏬',
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
          address: r.area || null,
          residenceArea: r.area || null,
          gender: GENDER[r.gender] || null,
          ageRange: AGE[r.age] || null,
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
          source: '안산 힐스테이트 오피스텔 방문자 디비.xlsx',
          totalRows: raw.length,
          success,
          skippedInvalid: invalid,
          skippedListDuplicate: listDup,
          skippedExisting: existing.size,
          assignedSite: SITE,
          isPublic: true,
          mode: 'hillstate-visitor-bulk-script',
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
