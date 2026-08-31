/**
 * 거주지 데이터 실측 리포트 (읽기 전용)
 *
 * Phase 1-A. 파서 사전을 만들기 전에 실제 데이터가 어떤 모양인지 먼저 본다.
 * 여기서 나온 top 문자열들이 lib/geo/regions.ts 사전과 테스트 케이스의 근거가 된다.
 *
 * 실행: pnpm tsx scripts/analyze-residence-area.ts
 *      pnpm tsx scripts/analyze-residence-area.ts --top 500
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TOP = (() => {
  const i = process.argv.indexOf('--top');
  return i >= 0 ? Number(process.argv[i + 1]) || 300 : 300;
})();

const pct = (n: number, total: number) => (total ? ((n / total) * 100).toFixed(1) : '0.0');

/** 문자열 형태 분류 — 파서 설계에 필요한 패턴 감각을 얻기 위한 거친 분류 */
function shapeOf(raw: string): string {
  const s = raw.trim();
  if (!s) return '빈값';
  if (/^\d+$/.test(s)) return '숫자만';
  if (/[a-zA-Z]/.test(s) && !/[가-힣]/.test(s)) return '영문만';
  if (!/[가-힣]/.test(s)) return '한글없음';

  const tokens = s.split(/\s+/).filter(Boolean);
  const hasSido = /(서울|경기|인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)/.test(s);
  const hasGuSiGun = /(구|시|군)(\s|$)/.test(s) || /(구|시|군)$/.test(s);
  const hasDong = /(동|읍|면|리)(\s|$)/.test(s) || /(동|읍|면|리)$/.test(s);

  const parts: string[] = [];
  if (hasSido) parts.push('시도');
  if (hasGuSiGun) parts.push('시군구');
  if (hasDong) parts.push('동읍면');
  if (!parts.length) parts.push('미분류');
  return `${parts.join('+')} (${tokens.length}토큰)`;
}

async function main() {
  console.log('='.repeat(78));
  console.log('거주지 데이터 실측 리포트');
  console.log('='.repeat(78));

  const total = await prisma.customer.count({ where: { isDeleted: false } });
  console.log(`\n전체 고객(미삭제): ${total.toLocaleString()}건`);

  // --- 1. 필드 채움률 ---
  const [raCount, addrCount, bothCount] = await Promise.all([
    prisma.customer.count({
      where: { isDeleted: false, NOT: { residenceArea: null }, residenceArea: { not: '' } },
    }),
    prisma.customer.count({
      where: { isDeleted: false, NOT: { address: null }, address: { not: '' } },
    }),
    prisma.customer.count({
      where: {
        isDeleted: false,
        residenceArea: { not: '' },
        address: { not: '' },
        NOT: [{ residenceArea: null }, { address: null }],
      },
    }),
  ]);

  console.log('\n' + '-'.repeat(78));
  console.log('[1] 필드 채움률');
  console.log('-'.repeat(78));
  console.log(`  residenceArea 채워짐 : ${raCount.toLocaleString()}건 (${pct(raCount, total)}%)`);
  console.log(`  address 채워짐       : ${addrCount.toLocaleString()}건 (${pct(addrCount, total)}%)`);
  console.log(`  둘 다 채워짐          : ${bothCount.toLocaleString()}건 (${pct(bothCount, total)}%)`);
  console.log(`  ⚠️ residenceArea 비어있음: ${(total - raCount).toLocaleString()}건 (${pct(total - raCount, total)}%)`);

  if (raCount === 0) {
    console.log('\n❌ residenceArea가 채워진 건이 하나도 없습니다. Phase 1 재검토 필요.');
    return;
  }

  // --- 2. 값 빈도 top N ---
  const grouped = await prisma.customer.groupBy({
    by: ['residenceArea'],
    where: { isDeleted: false, NOT: { residenceArea: null }, residenceArea: { not: '' } },
    _count: { _all: true },
    orderBy: { _count: { residenceArea: 'desc' } },
    take: TOP,
  });

  const distinctAll = await prisma.customer.findMany({
    where: { isDeleted: false, NOT: { residenceArea: null }, residenceArea: { not: '' } },
    select: { residenceArea: true },
    distinct: ['residenceArea'],
  });

  console.log('\n' + '-'.repeat(78));
  console.log(`[2] 고유값 개수: ${distinctAll.length.toLocaleString()}종 (채워진 ${raCount.toLocaleString()}건 중)`);
  console.log(`    상위 ${grouped.length}종이 ${pct(grouped.reduce((a, g) => a + g._count._all, 0), raCount)}% 를 차지`);
  console.log('-'.repeat(78));
  console.log(`\n순위  건수     비율    값`);
  grouped.forEach((g, i) => {
    const v = g.residenceArea ?? '';
    console.log(
      `${String(i + 1).padStart(4)}  ${String(g._count._all).padStart(6)}  ${pct(g._count._all, raCount).padStart(5)}%  ${JSON.stringify(v)}`
    );
  });

  // --- 3. 형태 분류 (전체 고유값 기준 + 건수 가중) ---
  const allValues = await prisma.customer.groupBy({
    by: ['residenceArea'],
    where: { isDeleted: false, NOT: { residenceArea: null }, residenceArea: { not: '' } },
    _count: { _all: true },
  });

  const shapeByRows = new Map<string, number>();
  const shapeByDistinct = new Map<string, number>();
  for (const g of allValues) {
    const sh = shapeOf(g.residenceArea ?? '');
    shapeByRows.set(sh, (shapeByRows.get(sh) || 0) + g._count._all);
    shapeByDistinct.set(sh, (shapeByDistinct.get(sh) || 0) + 1);
  }

  console.log('\n' + '-'.repeat(78));
  console.log('[3] 문자열 형태 분류 (건수 기준)');
  console.log('-'.repeat(78));
  [...shapeByRows.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) =>
      console.log(`  ${k.padEnd(30)} ${String(v).padStart(7)}건 (${pct(v, raCount).padStart(5)}%)  고유 ${shapeByDistinct.get(k)}종`)
    );

  // --- 4. 길이 분포 (이상치 탐지) ---
  const lens = allValues.map((g) => ({ len: (g.residenceArea ?? '').trim().length, n: g._count._all }));
  const lenBuckets = new Map<string, number>();
  for (const { len, n } of lens) {
    const b = len <= 2 ? '1-2자' : len <= 5 ? '3-5자' : len <= 10 ? '6-10자' : len <= 20 ? '11-20자' : '21자+';
    lenBuckets.set(b, (lenBuckets.get(b) || 0) + n);
  }
  console.log('\n' + '-'.repeat(78));
  console.log('[4] 길이 분포');
  console.log('-'.repeat(78));
  ['1-2자', '3-5자', '6-10자', '11-20자', '21자+'].forEach((b) => {
    const v = lenBuckets.get(b) || 0;
    if (v) console.log(`  ${b.padEnd(10)} ${String(v).padStart(7)}건 (${pct(v, raCount)}%)`);
  });

  // --- 5. 긴 값 샘플 (주소가 통째로 들어간 경우 확인) ---
  const longOnes = allValues
    .filter((g) => (g.residenceArea ?? '').trim().length > 15)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 20);
  if (longOnes.length) {
    console.log('\n  [긴 값 샘플 15자 초과 — 주소 통짜 입력 여부 확인]');
    longOnes.forEach((g) => console.log(`    ${String(g._count._all).padStart(4)}건  ${JSON.stringify(g.residenceArea)}`));
  }

  // --- 6. address 필드 샘플 (입력 UI가 없는데 값이 있는지) ---
  if (addrCount > 0) {
    const addrSamples = await prisma.customer.groupBy({
      by: ['address'],
      where: { isDeleted: false, NOT: { address: null }, address: { not: '' } },
      _count: { _all: true },
      orderBy: { _count: { address: 'desc' } },
      take: 20,
    });
    console.log('\n' + '-'.repeat(78));
    console.log(`[5] address 필드 상위 20종 (입력 UI가 없는데 ${addrCount}건 존재)`);
    console.log('-'.repeat(78));
    addrSamples.forEach((g) => console.log(`  ${String(g._count._all).padStart(5)}건  ${JSON.stringify(g.address)}`));
  }

  // --- 7. 현장별 채움률 (지역 분석 가치가 있는 현장 식별) ---
  const bySite = await prisma.customer.groupBy({
    by: ['assignedSite'],
    where: { isDeleted: false },
    _count: { _all: true },
  });
  const bySiteFilled = await prisma.customer.groupBy({
    by: ['assignedSite'],
    where: { isDeleted: false, NOT: { residenceArea: null }, residenceArea: { not: '' } },
    _count: { _all: true },
  });
  const filledMap = new Map(bySiteFilled.map((g) => [g.assignedSite ?? '(없음)', g._count._all]));

  console.log('\n' + '-'.repeat(78));
  console.log('[6] 현장별 거주지 채움률 — 지역 분석이 의미 있는 현장 식별');
  console.log('-'.repeat(78));
  bySite
    .sort((a, b) => b._count._all - a._count._all)
    .forEach((g) => {
      const site = g.assignedSite ?? '(없음)';
      const filled = filledMap.get(site) || 0;
      console.log(
        `  ${site.padEnd(24)} 전체 ${String(g._count._all).padStart(6)}건  채움 ${String(filled).padStart(6)}건 (${pct(filled, g._count._all).padStart(5)}%)`
      );
    });

  console.log('\n' + '='.repeat(78));
  console.log('판단 기준: 위 [3] 형태 분류에서 "시도" 또는 "시군구"를 포함한 비율이');
  console.log('           80% 이상이면 파서 작업 진행. 크게 미달이면 계획 재논의.');
  console.log('='.repeat(78));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
