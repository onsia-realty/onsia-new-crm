const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    const rows = await p.customer.findMany({
      where: { phone: '01024828514' },
      select: {
        id: true, name: true, phone: true, memo: true, assignedSite: true,
        assignedUserId: true, assignedAt: true, isPublic: true, isDeleted: true,
        grade: true, createdAt: true,
      },
    });
    for (const r of rows) {
      let assignee = null;
      if (r.assignedUserId) {
        assignee = await p.user.findUnique({
          where: { id: r.assignedUserId },
          select: { name: true, username: true, role: true },
        });
      }
      console.log(JSON.stringify({ ...r, assignee }, null, 2));
    }
    if (rows.length === 0) console.log('해당 번호 없음');
  } finally { await p.$disconnect(); }
})();
