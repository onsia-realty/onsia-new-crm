/**
 * 직원별 부재 DB 수량 집계 (읽기 전용)
 * 부재 = isDeleted=false, 담당자 있음, 가장 최근 통화기록(content)에 '부재' 포함
 *        (app/api/customers/route.ts 의 showAbsenceOnly 정의와 동일)
 * LMS 수기등록 DB(직원이 직접 창출) = lmsEligible=true OR lmsAd=true OR assignedSite='LMS 수기DB'
 *        → 공개DB 회수 대상에서 제외.
 */
const { PrismaClient } = require('@prisma/client');

const LMS_COND = `(COALESCE(c."lmsEligible", false) OR COALESCE(c."lmsAd", false) OR COALESCE(c."assignedSite" = 'LMS 수기DB', false))`;

(async () => {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT c."assignedUserId" AS uid,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE ${LMS_COND})::int AS lms,
             COUNT(*) FILTER (WHERE NOT ${LMS_COND})::int AS net
      FROM "Customer" c
      INNER JOIN (
        SELECT "customerId", MAX("createdAt") AS "lastCallAt"
        FROM "CallLog" GROUP BY "customerId"
      ) latest ON c.id = latest."customerId"
      INNER JOIN "CallLog" cl ON cl."customerId" = c.id AND cl."createdAt" = latest."lastCallAt"
      WHERE c."isDeleted" = false
        AND cl.content LIKE '%부재%'
        AND c."assignedUserId" IS NOT NULL
      GROUP BY c."assignedUserId"
      ORDER BY net DESC
    `);

    const users = await prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.uid) } },
      select: { id: true, name: true, username: true },
    });
    const umap = Object.fromEntries(users.map((u) => [u.id, u]));

    const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
    console.log('직원별 부재 DB — LMS 수기등록(직원 창출) 제외\n');
    console.log('순위  이름            아이디            부재전체   LMS수기(제외)   회수대상');
    rows.forEach((r, i) => {
      const u = umap[r.uid] || {};
      console.log(
        `${String(i + 1).padStart(3)}  ${(u.name ?? '(?)').padEnd(14)}  ${(u.username ?? r.uid).padEnd(16)}  ${String(r.total).padStart(7)}   ${String(r.lms).padStart(11)}   ${String(r.net).padStart(7)}`
      );
    });
    console.log('  --------------------------------------------------------------------------');
    console.log(`     합계                                    ${String(sum('total')).padStart(7)}   ${String(sum('lms')).padStart(11)}   ${String(sum('net')).padStart(7)}`);
  } finally { await prisma.$disconnect(); }
})();
