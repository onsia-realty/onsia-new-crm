/**
 * 공개DB 클레임률 분석 (읽기 전용 — SELECT/집계만)
 *
 * 실행: npx tsx scripts/analyze-public-db-claim-rate.ts
 * 인자: --from=YYYY-MM-DD --to=YYYY-MM-DD --user=<username> --employees=N --quota=M --json
 *
 * 주의: Customer.publicAt은 클레임 시 null로 지워지므로 모집단 기준으로 쓸 수 없음.
 *       모집단 = 현재 isPublic=true(삭제 포함) + 클레임된 distinct 고객수 로 추정.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const CLAIM_LIKE = '공개DB에서 클레임%';
const CONVERT_REASONS = ['공개DB로 전환', '공개DB로 전환 (대량등록 잘못 배정 복구)'];

// ── CLI ───────────────────────────────────────────────
function parseArgs() {
  const get = (k: string) => {
    const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(k.length + 3) : undefined;
  };
  const kstDay = (s: string | undefined, addDay = 0) =>
    s ? new Date(Date.parse(`${s}T00:00:00+09:00`) + addDay * 86400000) : null;
  return {
    from: kstDay(get('from')),
    to: kstDay(get('to'), 1), // exclusive end (해당일 24:00 KST)
    fromRaw: get('from') ?? null,
    toRaw: get('to') ?? null,
    user: get('user') ?? null,
    employees: Number(get('employees') ?? 5),
    quota: Number(get('quota') ?? 300),
    json: process.argv.includes('--json'),
  };
}

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);
const num = (v: unknown) => Number(v ?? 0);

async function main() {
  const args = parseArgs();

  // ── 1. 모집단 / 클레임 (스냅샷, 필터 미적용) ──────────
  const [remaining, deleted] = await Promise.all([
    prisma.customer.count({ where: { isPublic: true, isDeleted: false } }),
    prisma.customer.count({ where: { isPublic: true, isDeleted: true } }),
  ]);

  const claimedRows = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(DISTINCT "customerId")::int AS n
    FROM "CustomerAllocation" WHERE reason LIKE ${CLAIM_LIKE}`;
  const claimed = num(claimedRows[0]?.n);

  const population = remaining + deleted + claimed;

  // ── 2. 현재 잔여 통화 상태 분해 ────────────────────────
  const stateRows = await prisma.$queryRaw<
    { attempted: number; absent_only: number; real_call: number }[]
  >`
    SELECT
      count(*) FILTER (WHERE has_call)::int                   AS attempted,
      count(*) FILTER (WHERE has_call AND NOT has_real)::int  AS absent_only,
      count(*) FILTER (WHERE has_call AND has_real)::int      AS real_call
    FROM (
      SELECT
        EXISTS(SELECT 1 FROM "CallLog" l WHERE l."customerId" = c.id) AS has_call,
        EXISTS(SELECT 1 FROM "CallLog" l WHERE l."customerId" = c.id
               AND l.content NOT LIKE '%부재%') AS has_real
      FROM "Customer" c
      WHERE c."isPublic" = true AND c."isDeleted" = false
    ) t`;
  const remainingAttempted = num(stateRows[0]?.attempted);
  const remainingAbsentOnly = num(stateRows[0]?.absent_only);
  const remainingRealCall = num(stateRows[0]?.real_call);
  const remainingNoCall = remaining - remainingAttempted;

  // 통화 시도 모집단 = 잔여 중 통화된 건 + 클레임된 건(클레임은 통화를 전제)
  const attemptedPopulation = remainingAttempted + claimed;
  // 정상통화 연결 = 통화 시도 중 "부재만"이 아닌 건
  const connected = attemptedPopulation - remainingAbsentOnly;

  // ── 3~4. 월별 / 직원별 (first-claim 기준, 필터 적용) ───
  const conds: Prisma.Sql[] = [];
  if (args.from) conds.push(Prisma.sql`fc."createdAt" >= ${args.from}`);
  if (args.to) conds.push(Prisma.sql`fc."createdAt" < ${args.to}`);
  if (args.user) conds.push(Prisma.sql`u.username = ${args.user}`);
  const where = conds.length
    ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}`
    : Prisma.empty;

  const grouped = await prisma.$queryRaw<
    { month: string; name: string | null; username: string | null; cnt: number }[]
  >`
    WITH fc AS (
      SELECT DISTINCT ON (a."customerId")
             a."customerId", a."toUserId", a."createdAt"
      FROM "CustomerAllocation" a
      WHERE a.reason LIKE ${CLAIM_LIKE}
      ORDER BY a."customerId", a."createdAt" ASC, a.id ASC
    )
    SELECT to_char(fc."createdAt" + interval '9 hours', 'YYYY-MM') AS month,
           u.name, u.username, count(*)::int AS cnt
    FROM fc LEFT JOIN "User" u ON u.id = fc."toUserId"
    ${where}
    GROUP BY 1, 2, 3
    ORDER BY 1`;

  const byMonth = new Map<string, number>();
  const byUser = new Map<string, number>();
  for (const r of grouped) {
    byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.cnt);
    const label = r.name ? `${r.name}(${r.username})` : '(삭제된 사용자)';
    byUser.set(label, (byUser.get(label) ?? 0) + r.cnt);
  }
  const monthList = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const userList = [...byUser.entries()].sort((a, b) => b[1] - a[1]);
  const filteredTotal = userList.reduce((s, [, v]) => s + v, 0);

  // ── 5. 전환→클레임 소요일 분포 (전환 이력 있는 부분집합) ─
  const convTotalRows = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM "CustomerAllocation"
    WHERE reason = ANY(${CONVERT_REASONS})`;
  const conversionRows = num(convTotalRows[0]?.n);

  const lagRows = await prisma.$queryRaw<
    {
      n: number;
      b0: number;
      b1: number;
      b23: number;
      b47: number;
      b814: number;
      b1530: number;
      b30p: number;
      median: number | null;
      p90: number | null;
    }[]
  >`
    WITH conv AS (
      SELECT "customerId", "createdAt" AS conv_at
      FROM "CustomerAllocation" WHERE reason = ANY(${CONVERT_REASONS})
    ), matched AS (
      SELECT floor(EXTRACT(EPOCH FROM (
               (SELECT MIN(a."createdAt") FROM "CustomerAllocation" a
                WHERE a."customerId" = c."customerId"
                  AND a.reason LIKE ${CLAIM_LIKE}
                  AND a."createdAt" > c.conv_at) - c.conv_at)) / 86400)::int AS d
      FROM conv c
    )
    SELECT count(*)::int                                     AS n,
           count(*) FILTER (WHERE d = 0)::int                 AS b0,
           count(*) FILTER (WHERE d = 1)::int                 AS b1,
           count(*) FILTER (WHERE d BETWEEN 2 AND 3)::int     AS b23,
           count(*) FILTER (WHERE d BETWEEN 4 AND 7)::int     AS b47,
           count(*) FILTER (WHERE d BETWEEN 8 AND 14)::int    AS b814,
           count(*) FILTER (WHERE d BETWEEN 15 AND 30)::int   AS b1530,
           count(*) FILTER (WHERE d > 30)::int                AS b30p,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY d)     AS median,
           percentile_cont(0.9) WITHIN GROUP (ORDER BY d)     AS p90
    FROM matched WHERE d IS NOT NULL`;
  const lag = lagRows[0];

  // ── 6. 성숙 클레임률 (30일 이상 경과한 전환분만) ────────
  const cutoff = new Date(Date.now() - 30 * 86400000);
  const matureRows = await prisma.$queryRaw<{ total: number; claimed: number }[]>`
    WITH conv AS (
      SELECT "customerId", "createdAt" AS conv_at
      FROM "CustomerAllocation"
      WHERE reason = ANY(${CONVERT_REASONS}) AND "createdAt" <= ${cutoff}
    )
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE EXISTS(
             SELECT 1 FROM "CustomerAllocation" a
             WHERE a."customerId" = c."customerId"
               AND a.reason LIKE ${CLAIM_LIKE}
               AND a."createdAt" > c.conv_at))::int AS claimed
    FROM conv c`;
  const matureTotal = num(matureRows[0]?.total);
  const matureClaimed = num(matureRows[0]?.claimed);

  // ── 7. 보정 클레임률 (블랙리스트/삭제 제외) ─────────────
  const blRows = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(DISTINCT c.id)::int AS n
    FROM "Customer" c JOIN "Blacklist" b ON b.phone = c.phone
    WHERE c."isPublic" = true AND c."isDeleted" = false AND b."isActive" = true`;
  const blacklisted = num(blRows[0]?.n);
  const adjustedPopulation = population - deleted - blacklisted;

  // ── 8. 블라인드DB 시뮬레이션 ───────────────────────────
  const volume = args.employees * args.quota;
  const rateCall = pct(claimed, attemptedPopulation) / 100;
  const rateAll = pct(claimed, population) / 100;

  if (args.json) {
    console.log(
      JSON.stringify({
        filters: { from: args.fromRaw, to: args.toRaw, user: args.user },
        funnel: {
          population,
          remaining,
          deleted,
          attempted: attemptedPopulation,
          connected,
          claimed,
          claimRateAll: pct(claimed, population),
          claimRateOfCalls: pct(claimed, attemptedPopulation),
        },
        remainingState: {
          total: remaining,
          noCall: remainingNoCall,
          absentOnly: remainingAbsentOnly,
          realCallUnclaimed: remainingRealCall,
        },
        monthly: Object.fromEntries(monthList),
        byUser: Object.fromEntries(userList),
        filteredClaimTotal: filteredTotal,
        conversionSubset: {
          conversionRows,
          matchedClaims: num(lag?.n),
          buckets: {
            '0': num(lag?.b0),
            '1': num(lag?.b1),
            '2-3': num(lag?.b23),
            '4-7': num(lag?.b47),
            '8-14': num(lag?.b814),
            '15-30': num(lag?.b1530),
            '30+': num(lag?.b30p),
          },
          medianDays: lag?.median ?? null,
          p90Days: lag?.p90 ?? null,
        },
        mature: {
          cohort: matureTotal,
          claimed: matureClaimed,
          rate: pct(matureClaimed, matureTotal),
          note: 'right-censoring: 최근 30일 전환분 제외',
        },
        adjusted: {
          blacklistedRemaining: blacklisted,
          deletedExcluded: deleted,
          adjustedPopulation,
          adjustedClaimRate: pct(claimed, adjustedPopulation),
        },
        simulation: {
          employees: args.employees,
          quota: args.quota,
          volume,
          expectedByCallRate: Math.round(volume * rateCall),
          expectedByOverallRate: Math.round(volume * rateAll),
        },
      })
    );
    return;
  }

  const line = () => console.log('─'.repeat(64));
  console.log('\n📊 공개DB 클레임률 분석 (읽기 전용)');
  if (args.fromRaw || args.toRaw || args.user)
    console.log(
      `   필터(3)월별·4)직원별 섹션에만 적용, 나머지는 전체 스냅샷): from=${args.fromRaw ?? '-'} to=${args.toRaw ?? '-'} user=${args.user ?? '-'}`
    );

  line();
  console.log('1) 누적 퍼널');
  console.log(`   모집단(추정)      ${population.toLocaleString().padStart(8)}   (잔여 ${remaining.toLocaleString()} + 삭제 ${deleted.toLocaleString()} + 클레임 ${claimed.toLocaleString()})`);
  console.log(`   통화 시도         ${attemptedPopulation.toLocaleString().padStart(8)}   직전대비 ${f1(pct(attemptedPopulation, population))}%  전체대비 ${f1(pct(attemptedPopulation, population))}%`);
  console.log(`   정상통화 연결     ${connected.toLocaleString().padStart(8)}   직전대비 ${f1(pct(connected, attemptedPopulation))}%  전체대비 ${f1(pct(connected, population))}%`);
  console.log(`   클레임            ${claimed.toLocaleString().padStart(8)}   직전대비 ${f1(pct(claimed, connected))}%  전체대비 ${f1(pct(claimed, population))}%`);
  console.log(`   → 누적 클레임률 ${f2(pct(claimed, population))}% / 통화 대비 클레임률 ${f2(pct(claimed, attemptedPopulation))}%`);

  line();
  console.log(`2) 현재 잔여 상태 분해 (총 ${remaining.toLocaleString()}건)`);
  console.log(`   미통화                    ${remainingNoCall.toLocaleString().padStart(7)}  (${f1(pct(remainingNoCall, remaining))}%)`);
  console.log(`   통화 시도됨               ${remainingAttempted.toLocaleString().padStart(7)}  (${f1(pct(remainingAttempted, remaining))}%)`);
  console.log(`     └ 부재만                ${remainingAbsentOnly.toLocaleString().padStart(7)}  (통화건 중 ${f1(pct(remainingAbsentOnly, remainingAttempted))}%)`);
  console.log(`     └ 정상통화 있는데 미클레임 ${remainingRealCall.toLocaleString().padStart(5)}  (통화건 중 ${f1(pct(remainingRealCall, remainingAttempted))}%)`);

  line();
  console.log('3) 월별 클레임 추이 (KST, 고객별 최초 클레임 기준)');
  for (const [m, c] of monthList) {
    const bar = '█'.repeat(Math.round(c / 100));
    console.log(`   ${m}   ${c.toLocaleString().padStart(6)}  ${bar}`);
  }
  console.log(`   합계    ${filteredTotal.toLocaleString().padStart(6)}`);

  line();
  console.log(`4) 직원별 누적 클레임 (참여 직원 ${userList.length}명)`);
  for (const [label, c] of userList)
    console.log(`   ${label.padEnd(20)} ${c.toLocaleString().padStart(6)}  (${f1(pct(c, filteredTotal))}%)`);

  line();
  console.log('5) 전환→클레임 소요일 분포');
  console.log(`   ⚠️ 부분집합 분석: 전환 allocation 행 ${conversionRows.toLocaleString()}건만 대상`);
  console.log(`      (전체 클레임 ${claimed.toLocaleString()}건 중 대부분은 스크립트로 직접 isPublic 등록되어 전환 이력이 없음)`);
  console.log(`   매칭된 전환→클레임 사이클: ${num(lag?.n).toLocaleString()}건`);
  const buckets: [string, number][] = [
    ['0일', num(lag?.b0)],
    ['1일', num(lag?.b1)],
    ['2-3일', num(lag?.b23)],
    ['4-7일', num(lag?.b47)],
    ['8-14일', num(lag?.b814)],
    ['15-30일', num(lag?.b1530)],
    ['30일+', num(lag?.b30p)],
  ];
  for (const [b, c] of buckets)
    console.log(`   ${b.padEnd(8)} ${c.toLocaleString().padStart(6)}  (${f1(pct(c, num(lag?.n)))}%)`);
  console.log(`   median ${lag?.median ?? '-'}일 / p90 ${lag?.p90 ?? '-'}일`);

  line();
  console.log('6) 성숙 클레임률 (전환 후 30일 이상 경과한 코호트만)');
  console.log(`   코호트 ${matureTotal.toLocaleString()}건 → 클레임 ${matureClaimed.toLocaleString()}건 = ${f2(pct(matureClaimed, matureTotal))}%`);
  console.log('   ⚠️ 우측 절단(right-censoring) 경고: 최근 30일 이내 전환분은 아직 클레임될 시간이');
  console.log('      충분하지 않아 구조적으로 낮게 집계됨. 위 성숙 코호트 수치가 실질 상한에 가깝고,');
  console.log('      전체 기간 클레임률은 최근 유입분 때문에 과소평가됨.');

  line();
  console.log('7) 보정 클레임률 (클레임 불가 건 분모 제외)');
  console.log(`   제외: 삭제 ${deleted.toLocaleString()}건 + 블랙리스트(활성) 번호 잔여 ${blacklisted.toLocaleString()}건`);
  console.log(`   보정 모집단 ${adjustedPopulation.toLocaleString()} → 보정 클레임률 ${f2(pct(claimed, adjustedPopulation))}%`);

  line();
  console.log(`8) 블라인드DB 기대치 시뮬레이션 (직원 ${args.employees}명 × 할당 ${args.quota}건)`);
  console.log(`   물량 ${volume.toLocaleString()}건`);
  console.log(`   시나리오A 통화대비 클레임률 ${f2(rateCall * 100)}% → 예상 클레임 ${Math.round(volume * rateCall).toLocaleString()}건`);
  console.log(`   시나리오B 전체 클레임률   ${f2(rateAll * 100)}% → 예상 클레임 ${Math.round(volume * rateAll).toLocaleString()}건`);
  line();
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
