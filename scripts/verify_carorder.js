const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    const owner = await p.user.findFirst({ where: { username: 'cnwogus0127' }, select: { id: true, name: true } });
    // 방금 등록분 근사: 추재현 + LMS 수기DB + lmsEligible + 통화기록 없음(신규) — 정확 검증은 최근 createdAt로
    const since = new Date(Date.now() - 30 * 60 * 1000); // 최근 30분
    const rows = await p.customer.findMany({
      where: { assignedUserId: owner.id, assignedSite: 'LMS 수기DB', lmsEligible: true, createdAt: { gte: since }, isDeleted: false },
      select: { phone: true, memo: true, isPublic: true, assignedUserId: true, name: true },
    });
    const uniq = new Set(rows.map((r) => r.phone));
    console.log('최근 30분 등록(추재현/LMS수기/lmsEligible):', rows.length, '| 고유번호:', uniq.size);
    console.log('isPublic 전부 false:', rows.every((r) => !r.isPublic));
    console.log('담당 전부 추재현:', rows.every((r) => r.assignedUserId === owner.id));
    console.log('memo 있는 건:', rows.filter((r) => r.memo).length, '| 빈값:', rows.filter((r) => !r.memo).length);
    // 상태 분포 상위
    const dist = {};
    rows.forEach((r) => { const k = r.memo || '(빈)'; dist[k] = (dist[k] || 0) + 1; });
    const top = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.log('memo 상위:', JSON.stringify(Object.fromEntries(top)));
    // 추재현 LMS수기 총계
    const totalLms = await p.customer.count({ where: { assignedUserId: owner.id, assignedSite: 'LMS 수기DB', lmsEligible: true, isDeleted: false } });
    console.log('추재현 LMS수기DB 총계:', totalLms);
  } finally { await p.$disconnect(); }
})();
