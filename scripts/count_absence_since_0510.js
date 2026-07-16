/**
 * 5/10 이후 '부재 정리된' DB 확인 (읽기 전용)
 * 기준: isDeleted=false, 담당자 있음, 마지막 통화가 '부재', 그 부재 통화 createdAt >= 2026-05-10
 * 제외: LMS 수기등록 (lmsEligible OR lmsAd OR assignedSite='LMS 수기DB')
 */
const { PrismaClient } = require('@prisma/client');

const FROM = '2026-05-10';
const LMS = `(COALESCE(c."lmsEligible", false) OR COALESCE(c."lmsAd", false) OR COALESCE(c."assignedSite" = 'LMS 수기DB', false))`;

(async () => {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT c."assignedUserId" AS uid, COUNT(*)::int AS cnt
      FROM "Customer" c
      INNER JOIN (
        SELECT "customerId", MAX("createdAt") AS "lastCallAt"
        FROM "CallLog" GROUP BY "customerId"
      ) latest ON c.id = latest."customerId"
      INNER JOIN "CallLog" cl ON cl."customerId" = c.id AND cl."createdAt" = latest."lastCallAt"
      WHERE c."isDeleted" = false
        AND c."assignedUserId" IS NOT NULL
        AND cl.content LIKE '%부재%'
        AND latest."lastCallAt" >= '${FROM}'
        AND NOT ${LMS}
      GROUP BY c."assignedUserId"
      ORDER BY cnt DESC
    `);

    const users = await prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.uid) } },
      select: { id: true, name: true, username: true },
    });
    const umap = Object.fromEntries(users.map((u) => [u.id, u]));
    const total = rows.reduce((s, r) => s + r.cnt, 0);

    console.log(`기준: 마지막 통화='부재' & 부재통화 ${FROM} 이후 & 담당자 있음 & LMS수기 제외\n`);
    console.log('순위  이름            아이디             건수');
    rows.forEach((r, i) => {
      const u = umap[r.uid] || {};
      console.log(`${String(i + 1).padStart(3)}  ${(u.name ?? '(?)').padEnd(14)}  ${(u.username ?? r.uid).padEnd(16)}  ${String(r.cnt).padStart(5)}`);
    });
    console.log('  -----------------------------------------------');
    console.log(`     합계                                ${String(total).padStart(5)}`);
  } finally { await prisma.$disconnect(); }
})();
