const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    const rows = await p.customer.findMany({
      where: { assignedSite: '서희4차', isDeleted: false },
      select: { phone: true, name: true, memo: true, isPublic: true, assignedUserId: true, displayOrder: true },
    });
    const phones = rows.map((r) => r.phone);
    const uniq = new Set(phones);
    const site = await p.site.findUnique({ where: { name: '서희4차' } });
    console.log('건수:', rows.length);
    console.log('고유 전화번호 수:', uniq.size);
    console.log('isPublic 전부 true:', rows.every((r) => r.isPublic));
    console.log('미배정 전부(assignedUserId null):', rows.every((r) => r.assignedUserId === null));
    console.log('이름 서희4차 접두어 전부:', rows.every((r) => /^서희4차 \d{4}$/.test(r.name)));
    const nums = rows.map((r) => +r.name.split(' ')[1]).sort((a, b) => a - b);
    console.log('이름 순번 범위:', nums[0], '~', nums[nums.length - 1], '연속:', nums.every((n, i) => i === 0 || n === nums[i - 1] + 1));
    console.log('01024828514(배정된고객) 미포함:', !uniq.has('01024828514'));
    console.log('01092045397(기존공개) 미포함:', !uniq.has('01092045397'));
    const assignedElsewhere = await p.customer.count({
      where: { phone: { in: phones }, assignedUserId: { not: null }, assignedSite: { not: '서희4차' }, isDeleted: false },
    });
    console.log('같은 번호가 다른 곳에 배정된 레코드:', assignedElsewhere);
    console.log('Site:', site ? `${site.icon} ${site.name} color=${site.color} sortOrder=${site.sortOrder} active=${site.isActive}` : '없음!');
    console.log('memo 샘플:', rows.slice(0, 3).map((r) => `${r.name}:${r.memo}`).join(' | '));
    console.log('주석 보존 확인:', rows.filter((r) => /[()]/.test(r.memo)).slice(0, 5).map((r) => r.memo).join(' | '));
  } finally { await p.$disconnect(); }
})();
