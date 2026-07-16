const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    const rows = await p.customer.findMany({
      where: { assignedSite: '서희4차', isDeleted: false },
      select: { phone: true, name: true, isPublic: true, assignedUserId: true },
    });
    const phones = rows.map((r) => r.phone);
    const uniq = new Set(phones);
    const nums = rows.map((r) => +r.name.split(' ')[1]).sort((a, b) => a - b);
    console.log('서희4차 총 건수:', rows.length);
    console.log('고유 전화번호 수:', uniq.size, '(중복', rows.length - uniq.size, ')');
    console.log('isPublic 전부 true:', rows.every((r) => r.isPublic));
    console.log('미배정 전부:', rows.every((r) => r.assignedUserId === null));
    console.log('이름 접두어 전부:', rows.every((r) => /^서희4차 \d{4}$/.test(r.name)));
    console.log('이름 순번 범위:', nums[0], '~', nums[nums.length - 1], '연속:', nums.every((n, i) => i === 0 || n === nums[i - 1] + 1));
    // 제외했어야 할 대표 번호 미포함 확인
    const mustExclude = ['01091950691', '01028815490', '01028388989', '01020357638', '01039028916', '0103268097'];
    console.log('제외 대상 미포함:', mustExclude.every((ph) => !uniq.has(ph)), '→', mustExclude.filter((ph) => uniq.has(ph)));
    // 같은 번호가 다른 곳에 배정된 레코드 0
    const elsewhere = await p.customer.count({
      where: { phone: { in: phones }, assignedUserId: { not: null }, assignedSite: { not: '서희4차' }, isDeleted: false },
    });
    console.log('같은 번호가 다른 곳에 배정된 레코드:', elsewhere);
  } finally { await p.$disconnect(); }
})();
